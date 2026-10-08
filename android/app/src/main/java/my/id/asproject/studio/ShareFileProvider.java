package my.id.asproject.studio;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Locale;

/**
 * Minimal, dependency free file provider.
 *
 * <p>The project intentionally avoids AndroidX, so {@code androidx.core.content.FileProvider} cannot
 * be used. This provider exposes exactly three folders — the app specific external files folder, the
 * internal files folder and the cache folder — which is all the app needs to (a) open or share an
 * exported file and (b) hand a writable URI to the system camera for "Ambil Foto".
 *
 * <p>Only read access is granted to receivers of a {@code content://} URI; the authority is not
 * exported and every path is validated against the allowed roots (no traversal).
 */
public class ShareFileProvider extends ContentProvider {

    private static final String TAG = "AsProjectProvider";

    private static final String ROOT_EXTERNAL = "ext";
    private static final String ROOT_FILES = "files";
    private static final String ROOT_CACHE = "cache";

    /** Authority declared in AndroidManifest.xml ({@code applicationId + ".files"}). */
    public static String authority(Context context) {
        return context.getPackageName() + ".files";
    }

    /** Builds a shareable {@code content://} URI for a file that lives in an allowed folder. */
    public static Uri uriFor(Context context, File file) {
        if (file == null) {
            return null;
        }
        String path = file.getAbsolutePath();
        String[][] roots = rootCandidates(context);
        for (String[] root : roots) {
            String dir = root[1];
            if (dir == null) {
                continue;
            }
            if (path.equals(dir) || path.startsWith(dir + File.separator)) {
                String relative = path.substring(dir.length());
                relative = relative.replace(File.separatorChar, '/');
                while (relative.startsWith("/")) {
                    relative = relative.substring(1);
                }
                return new Uri.Builder()
                        .scheme("content")
                        .authority(authority(context))
                        .appendPath(root[0])
                        .appendEncodedPath(relative)
                        .build();
            }
        }
        return null;
    }

    /** Creates a fresh file (inside the cache folder) that the camera app may write into. */
    public static File newCameraTarget(Context context) throws IOException {
        File dir = new File(context.getCacheDir(), "camera");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("tidak bisa membuat folder kamera");
        }
        return new File(dir, "foto-" + System.currentTimeMillis() + ".jpg");
    }

    private static String[][] rootCandidates(Context context) {
        File external = context.getExternalFilesDir(null);
        return new String[][]{
                {ROOT_EXTERNAL, external == null ? null : external.getAbsolutePath()},
                {ROOT_FILES, context.getFilesDir() == null ? null : context.getFilesDir().getAbsolutePath()},
                {ROOT_CACHE, context.getCacheDir() == null ? null : context.getCacheDir().getAbsolutePath()},
        };
    }

    private static File resolve(Context context, Uri uri) throws FileNotFoundException {
        if (uri == null || uri.getPathSegments().isEmpty()) {
            throw new FileNotFoundException("uri kosong");
        }
        String rootKey = uri.getPathSegments().get(0);
        StringBuilder relative = new StringBuilder();
        for (int i = 1; i < uri.getPathSegments().size(); i++) {
            if (relative.length() > 0) {
                relative.append('/');
            }
            relative.append(uri.getPathSegments().get(i));
        }
        for (String[] root : rootCandidates(context)) {
            if (!root[0].equals(rootKey) || root[1] == null) {
                continue;
            }
            File base = new File(root[1]);
            File target = new File(base, relative.toString());
            try {
                String basePath = base.getCanonicalPath();
                String targetPath = target.getCanonicalPath();
                if (!targetPath.equals(basePath) && !targetPath.startsWith(basePath + File.separator)) {
                    throw new FileNotFoundException("keluar dari folder yang diizinkan");
                }
            } catch (IOException e) {
                throw new FileNotFoundException("path tidak valid");
            }
            return target;
        }
        throw new FileNotFoundException("root tidak dikenal: " + rootKey);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        Context context = getContext();
        if (context == null) {
            throw new FileNotFoundException("context null");
        }
        File file = resolve(context, uri);
        int flags;
        if (mode != null && mode.contains("w")) {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new FileNotFoundException("tidak bisa membuat folder");
            }
            flags = ParcelFileDescriptor.MODE_WRITE_ONLY
                    | ParcelFileDescriptor.MODE_CREATE
                    | ParcelFileDescriptor.MODE_TRUNCATE;
        } else {
            if (!file.exists()) {
                throw new FileNotFoundException(file.getAbsolutePath());
            }
            flags = ParcelFileDescriptor.MODE_READ_ONLY;
        }
        return ParcelFileDescriptor.open(file, flags);
    }

    @Override
    public String getType(Uri uri) {
        String name = uri == null ? "" : uri.getLastPathSegment();
        if (name == null) {
            return "application/octet-stream";
        }
        int dot = name.lastIndexOf('.');
        if (dot >= 0 && dot < name.length() - 1) {
            String extension = name.substring(dot + 1).toLowerCase(Locale.ROOT);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (mime != null) {
                return mime;
            }
        }
        return "application/octet-stream";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs,
                        String sortOrder) {
        Context context = getContext();
        if (context == null) {
            return null;
        }
        String[] columns = projection != null ? projection
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        try {
            File file = resolve(context, uri);
            MatrixCursor.RowBuilder row = cursor.newRow();
            for (String column : columns) {
                if (OpenableColumns.DISPLAY_NAME.equals(column)) {
                    row.add(file.getName());
                } else if (OpenableColumns.SIZE.equals(column)) {
                    row.add(file.exists() ? file.length() : 0L);
                } else {
                    row.add(null);
                }
            }
        } catch (FileNotFoundException e) {
            // Return an empty cursor: receivers treat "no row" as missing file.
            return cursor;
        }
        return cursor;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        Context context = getContext();
        if (context == null) {
            return 0;
        }
        try {
            File file = resolve(context, uri);
            // Only cached / generated files may be removed through the provider.
            String cacheRoot = context.getCacheDir() == null
                    ? null : context.getCacheDir().getAbsolutePath();
            if (cacheRoot != null && file.getCanonicalPath().startsWith(cacheRoot + File.separator)
                    && file.exists() && file.delete()) {
                return 1;
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "delete gagal", e);
        }
        return 0;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("insert tidak didukung");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("update tidak didukung");
    }
}
