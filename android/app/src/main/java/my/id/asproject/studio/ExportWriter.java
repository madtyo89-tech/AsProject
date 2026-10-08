package my.id.asproject.studio;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Receives exported files (HTML invitation, guest CSV, QR PNG, …) from the web layer and stores them
 * in the device "Downloads" collection (Android 10+) or in the app-specific downloads folder
 * (Android 9 and older, so that no storage permission is required on any supported version).
 *
 * <p>The web layer transfers the bytes in base64 chunks through {@link NativeBridge} so that multi
 * megabyte exports do not have to cross the JavaScript bridge in a single string.
 */
public final class ExportWriter {

    private static final String TAG = "AsProjectExport";

    /** Hard limit for one exported file (the Studio itself refuses > ~1.5 MB drafts). */
    private static final long MAX_BYTES = 64L * 1024 * 1024;

    /** Open transfers are dropped after this to avoid leaking memory. */
    private static final long TOKEN_TTL_MS = 5L * 60L * 1000L;

    private static final int MAX_OPEN_TRANSFERS = 4;

    private final Context context;
    private final Map<String, Transfer> transfers = new HashMap<>();

    public ExportWriter(Context context) {
        this.context = context.getApplicationContext();
    }

    /** Result of a completed export. */
    public static final class Saved {
        public final boolean ok;
        public final String name;
        public final String mime;
        public final String uri;
        public final String location;
        public final String error;

        Saved(boolean ok, String name, String mime, String uri, String location, String error) {
            this.ok = ok;
            this.name = name;
            this.mime = mime;
            this.uri = uri;
            this.location = location;
            this.error = error;
        }

        /** JSON consumed by {@code native-bridge.js}. */
        public String toJson() {
            try {
                JSONObject json = new JSONObject();
                json.put("ok", ok);
                json.put("name", name == null ? "" : name);
                json.put("mime", mime == null ? "" : mime);
                json.put("uri", uri == null ? "" : uri);
                json.put("location", location == null ? "" : location);
                json.put("error", error == null ? "" : error);
                return json.toString();
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":\"json\"}";
            }
        }
    }

    private static final class Transfer {
        String name;
        String mime;
        final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        final long startedAt = System.currentTimeMillis();
        boolean finished;
    }

    /** Starts a chunked export. Returns a token, or {@code ERR:<reason>}. */
    public synchronized String begin(String rawName, String rawMime) {
        purgeExpired();
        if (transfers.size() >= MAX_OPEN_TRANSFERS) {
            return "ERR:too-many-open-transfers";
        }
        String name = sanitizeFileName(rawName);
        String mime = sanitizeMime(rawMime, name);
        String token = UUID.randomUUID().toString();
        Transfer transfer = new Transfer();
        transfer.name = name;
        transfer.mime = mime;
        transfers.put(token, transfer);
        return token;
    }

    /** Appends one base64 chunk. Returns {@code false} when the token is unknown or too large. */
    public synchronized boolean append(String token, String base64Chunk) {
        Transfer transfer = token == null ? null : transfers.get(token);
        if (transfer == null || transfer.finished) {
            return false;
        }
        if (transfer.buffer.size() > MAX_BYTES) {
            transfers.remove(token);
            return false;
        }
        if (base64Chunk == null || base64Chunk.isEmpty()) {
            return true;
        }
        try {
            byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
            if (transfer.buffer.size() + bytes.length > MAX_BYTES) {
                transfers.remove(token);
                return false;
            }
            transfer.buffer.write(bytes);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Chunk base64 tidak valid", e);
            transfers.remove(token);
            return false;
        }
    }

    /** Completes the export and writes it to the device. Returns a JSON result string. */
    public synchronized String finish(String token) {
        Transfer transfer = token == null ? null : transfers.remove(token);
        if (transfer == null) {
            return new Saved(false, null, null, null, null, "token-unknown").toJson();
        }
        transfer.finished = true;
        byte[] data = transfer.buffer.toByteArray();
        Saved saved = save(context, transfer.name, transfer.mime, data);
        return saved.toJson();
    }

    /** One shot export (small files only). */
    public synchronized String saveNow(String rawName, String rawMime, String base64Data) {
        String name = sanitizeFileName(rawName);
        String mime = sanitizeMime(rawMime, name);
        try {
            byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
            return save(context, name, mime, data).toJson();
        } catch (Exception e) {
            return new Saved(false, name, mime, null, null, "base64-tidak-valid").toJson();
        }
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();
        transfers.entrySet().removeIf(entry -> now - entry.getValue().startedAt > TOKEN_TTL_MS);
    }

    /** Writes {@code data} to Downloads (API 29+) or the app downloads folder (older). */
    public static Saved save(Context context, String name, String mime, byte[] data) {
        String fileName = sanitizeFileName(name);
        String contentType = sanitizeMime(mime, fileName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, contentType);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                Uri item = resolver.insert(collection, values);
                if (item == null) {
                    return new Saved(false, fileName, contentType, null, null, "media-store-menolak");
                }
                try (OutputStream out = resolver.openOutputStream(item, "w")) {
                    if (out == null) {
                        return new Saved(false, fileName, contentType, null, null, "stream-kosong");
                    }
                    out.write(data);
                    out.flush();
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(item, done, null, null);
                return new Saved(true, fileName, contentType, item.toString(),
                        "Unduhan/" + fileName, null);
            } catch (Exception e) {
                Log.e(TAG, "Gagal menyimpan ke MediaStore", e);
                return new Saved(false, fileName, contentType, null, null, shortMessage(e));
            }
        }
        // Android 9 and older: no storage permission needed inside the app specific folder.
        try {
            File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) {
                dir = new File(context.getFilesDir(), "exports");
            }
            if (!dir.exists() && !dir.mkdirs()) {
                return new Saved(false, fileName, contentType, null, null, "folder-tidak-bisa-dibuat");
            }
            File target = new File(dir, fileName);
            try (FileOutputStream out = new FileOutputStream(target)) {
                out.write(data);
                out.flush();
            }
            Uri shared = ShareFileProvider.uriFor(context, target);
            return new Saved(true, fileName, contentType,
                    shared == null ? null : shared.toString(),
                    target.getAbsolutePath(), null);
        } catch (Exception e) {
            Log.e(TAG, "Gagal menyimpan file ekspor", e);
            return new Saved(false, fileName, contentType, null, null, shortMessage(e));
        }
    }

    /** Keeps the file name safe for the Downloads collection. */
    public static String sanitizeFileName(String raw) {
        String name = raw == null ? "" : raw.trim();
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        StringBuilder out = new StringBuilder(name.length());
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            boolean legal = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
            legal = legal || c == '.' || c == '_' || c == '-' || c == ' ' || c == '(' || c == ')';
            out.append(legal ? c : '_');
        }
        String cleaned = out.toString().trim().replaceAll("\\s+", " ");
        cleaned = cleaned.replaceAll("^[.]+", "");
        if (cleaned.isEmpty()) {
            cleaned = "asproject-export";
        }
        if (cleaned.length() > 96) {
            String extension = extensionOf(cleaned);
            String base = cleaned.substring(0, 96 - extension.length());
            cleaned = base + extension;
        }
        return cleaned;
    }

    /** Guesses a MIME type from the file name when the web layer does not provide one. */
    public static String sanitizeMime(String rawMime, String fileName) {
        String mime = rawMime == null ? "" : rawMime.trim();
        if (mime.isEmpty() || "*/*".equals(mime) || mime.contains(" ")) {
            mime = guessMime(fileName);
        }
        return mime;
    }

    private static String guessMime(String fileName) {
        String extension = extensionOf(fileName).toLowerCase(Locale.ROOT);
        switch (extension) {
            case ".html":
            case ".htm":
                return "text/html";
            case ".csv":
                return "text/csv";
            case ".txt":
                return "text/plain";
            case ".json":
                return "application/json";
            case ".png":
                return "image/png";
            case ".jpg":
            case ".jpeg":
                return "image/jpeg";
            case ".webp":
                return "image/webp";
            case ".mp3":
                return "audio/mpeg";
            case ".pdf":
                return "application/pdf";
            case ".zip":
                return "application/zip";
            default:
                return "application/octet-stream";
        }
    }

    private static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot);
    }

    private static String shortMessage(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isEmpty()) {
            return e.getClass().getSimpleName();
        }
        return message.length() > 120 ? message.substring(0, 120) : message;
    }
}
