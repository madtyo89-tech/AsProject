package my.id.asproject.studio;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;

import java.util.Locale;

/**
 * Hands links over to the most suitable Android application, falling back to the browser.
 *
 * <p>WhatsApp links ({@code wa.me}, {@code api.whatsapp.com}, {@code chat.whatsapp.com}) are turned
 * into {@code whatsapp://send} intents when WhatsApp is installed, Google Maps links are opened with
 * the Maps app when possible, and everything else uses a plain {@code ACTION_VIEW} so that the
 * system (or the user) decides which app handles it.
 */
public final class ExternalLinks {

    private static final String TAG = "AsProjectLinks";

    private static final String PKG_WHATSAPP = "com.whatsapp";
    private static final String PKG_WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final String PKG_MAPS = "com.google.android.apps.maps";

    private ExternalLinks() {
    }

    /**
     * Opens {@code url} outside the app.
     *
     * @return {@code true} when an activity was started successfully.
     */
    public static boolean open(Context context, String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        String trimmed = url.trim();
        UrlPolicy.Parts parts = UrlPolicy.parse(trimmed);

        // 1) WhatsApp deep link (prefer the native app, fall back to https).
        if (isWhatsAppLink(parts)) {
            if (isInstalled(context, PKG_WHATSAPP) || isInstalled(context, PKG_WHATSAPP_BUSINESS)) {
                String deepLink = whatsappDeepLink(trimmed);
                if (deepLink != null && startView(context, deepLink)) {
                    return true;
                }
            }
            return startView(context, trimmed);
        }

        // 2) Google Maps: use the geo: intent for plain search links, https otherwise (App Links).
        if (isMapsLink(parts) && isInstalled(context, PKG_MAPS)) {
            String geo = mapsGeoIntent(trimmed);
            if (geo != null && startView(context, geo)) {
                return true;
            }
        }

        // 3) intent:// links carry their own target package + fallback URL.
        if ("intent".equals(parts.scheme)) {
            try {
                Intent intent = Intent.parseUri(trimmed, Intent.URI_INTENT_SCHEME);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                String fallback = null;
                try {
                    Intent parsed = Intent.parseUri(trimmed, Intent.URI_INTENT_SCHEME);
                    fallback = parsed.getStringExtra("browser_fallback_url");
                } catch (Exception ignored) {
                    // ignore
                }
                if (fallback != null && !fallback.isEmpty()) {
                    return open(context, fallback);
                }
                Log.w(TAG, "intent:// sinir gagal: " + trimmed, e);
                return false;
            }
        }

        // 4) Phone / SMS / Mail get their dedicated actions.
        switch (parts.scheme) {
            case "tel":
                return startView(context, new Intent(Intent.ACTION_DIAL, Uri.parse(trimmed)));
            case "mailto":
                return startView(context, new Intent(Intent.ACTION_SENDTO, Uri.parse(trimmed)));
            case "sms":
            case "smsto":
            case "mms":
                return startView(context, new Intent(Intent.ACTION_SENDTO, Uri.parse(trimmed)));
            default:
                break;
        }

        // 5) Everything else (http/https, market, geo, whatsapp:, ...) through ACTION_VIEW.
        if (startView(context, trimmed)) {
            return true;
        }

        // 6) Last resort for web links: hand them to a browser-only intent.
        if (UrlPolicy.isWebUrl(trimmed)) {
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(trimmed));
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            browser.setPackage(null);
            return startView(context, browser);
        }
        return false;
    }

    private static boolean startView(Context context, String uri) {
        return startView(context, new Intent(Intent.ACTION_VIEW, Uri.parse(uri)));
    }

    private static boolean startView(Context context, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "Tidak ada aplikasi untuk: " + intent, e);
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Gagal membuka intent: " + intent, e);
            return false;
        }
    }

    private static boolean isInstalled(Context context, String pkg) {
        try {
            context.getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isWhatsAppLink(UrlPolicy.Parts parts) {
        if ("whatsapp".equals(parts.scheme)) {
            return true;
        }
        String host = parts.host;
        return host.equals("wa.me")
                || host.endsWith(".wa.me")
                || host.equals("api.whatsapp.com")
                || host.equals("web.whatsapp.com")
                || host.equals("chat.whatsapp.com")
                || host.endsWith(".whatsapp.com");
    }

    /** {@code https://wa.me/?text=Halo} becomes {@code whatsapp://send?text=Halo}. */
    private static String whatsappDeepLink(String url) {
        try {
            Uri uri = Uri.parse(url);
            String text = uri.getQueryParameter("text");
            String phone = uri.getQueryParameter("phone");
            Uri.Builder builder = new Uri.Builder()
                    .scheme("whatsapp")
                    .authority("send");
            if (phone != null && !phone.isEmpty()) {
                builder.appendQueryParameter("phone", phone);
            }
            if (text != null) {
                builder.appendQueryParameter("text", text);
            } else if (phone == null || phone.isEmpty()) {
                return null;
            }
            return builder.build().toString();
        } catch (Exception e) {
            Log.w(TAG, "Gagal menyusun deep link WhatsApp", e);
            return null;
        }
    }

    private static boolean isMapsLink(UrlPolicy.Parts parts) {
        String host = parts.host;
        if (host.endsWith("maps.google.com") || host.endsWith("maps.google.co.id")) {
            return true;
        }
        if (host.equals("www.google.com") || host.equals("google.com")) {
            return parts.raw.contains("/maps");
        }
        return host.equals("maps.app.goo.gl") || host.startsWith("goo.gl");
    }

    /** Turns {@code …/maps?q=Gedung+X} into {@code geo:0,0?q=Gedung+X}. */
    private static String mapsGeoIntent(String url) {
        try {
            Uri uri = Uri.parse(url);
            String query = uri.getQueryParameter("q");
            if (query == null || query.isEmpty()) {
                return null;
            }
            return "geo:0,0?q=" + Uri.encode(query);
        } catch (Exception e) {
            return null;
        }
    }

    /** Human readable label used in the "buka di aplikasi lain" dialog. */
    public static String describe(String url) {
        UrlPolicy.Parts parts = UrlPolicy.parse(url);
        if (isWhatsAppLink(parts)) {
            return "WhatsApp";
        }
        if (isMapsLink(parts)) {
            return "Google Maps";
        }
        switch (parts.scheme.toLowerCase(Locale.ROOT)) {
            case "tel":
                return "Telepon";
            case "mailto":
                return "Email";
            case "sms":
            case "smsto":
                return "SMS";
            default:
                return parts.host.isEmpty() ? url : parts.host;
        }
    }
}
