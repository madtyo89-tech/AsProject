package my.id.asproject.studio;

import java.util.Locale;

/**
 * URL classification for the AsProject Studio wrapper.
 *
 * <p>Deliberately written as plain Java (no {@code android.*} imports) so that the navigation and
 * security rules can be unit tested on a desktop JVM — see {@code android/tests/jvm}.
 *
 * <p>Rules:
 * <ul>
 *   <li>Only {@code https} URLs on {@link #ALLOWED_HOSTS} (or their sub-domains) may be rendered
 *       inside the app WebView. Everything else is handed over to the Android system / browser.</li>
 *   <li>{@code http://} links on an allowed host are upgraded to {@code https://} instead of being
 *       loaded in clear text.</li>
 *   <li>Prefix/poisoned hosts (e.g. {@code asproject.my.id.evil.com}, {@code evil.com/asproject.my.id})
 *       are never treated as internal.</li>
 * </ul>
 */
public final class UrlPolicy {

    /** Entry point of the Studio that the wrapper app opens. */
    public static final String STUDIO_URL = "https://asproject.my.id/studio.html";

    /** Fallback URL used when the entry point itself fails. */
    public static final String HOME_URL = "https://asproject.my.id/";

    /** Hosts that may be rendered inside the app. A sub-domain of a listed host is also allowed. */
    private static final String[] ALLOWED_HOSTS = {
            "asproject.my.id",
    };

    /** Schemes that must never be forwarded to another app (they are WebView internal). */
    private static final String[] NON_NAVIGABLE_SCHEMES = {
            "about", "blob", "data", "javascript", "file", "content", "chrome", "ws", "wss",
    };

    /** Schemes that are meant to be opened by another Android application. */
    private static final String[] EXTERNAL_APP_SCHEMES = {
            "mailto", "tel", "sms", "smsto", "mms", "market", "geo", "intent",
            "whatsapp", "waze", "google.navigation", "maps", "tg", "line", "skype", "viber",
            "zoomus", "upi", "fb", "twitter", "instagram",
    };

    private UrlPolicy() {
    }

    /** Immutable parse result. */
    public static final class Parts {
        public final String raw;
        public final String scheme;
        public final String host;

        Parts(String raw, String scheme, String host) {
            this.raw = raw;
            this.scheme = scheme;
            this.host = host;
        }

        @Override
        public String toString() {
            return "Parts{scheme=" + scheme + ", host=" + host + "}";
        }
    }

    /**
     * Small, dependency free URL splitter. Returns empty {@code scheme}/{@code host} for relative
     * or malformed input, which callers must treat as "not internal".
     */
    public static Parts parse(String url) {
        String raw = url == null ? "" : url.trim();
        String scheme = "";
        String host = "";
        int colon = raw.indexOf(':');
        if (colon > 0) {
            String candidate = raw.substring(0, colon);
            if (isSchemeToken(candidate)) {
                scheme = candidate.toLowerCase(Locale.ROOT);
                String rest = raw.substring(colon + 1);
                if (rest.startsWith("//")) {
                    rest = rest.substring(2);
                    int end = rest.length();
                    for (int i = 0; i < rest.length(); i++) {
                        char c = rest.charAt(i);
                        if (c == '/' || c == '?' || c == '#') {
                            end = i;
                            break;
                        }
                    }
                    String authority = rest.substring(0, end);
                    int at = authority.lastIndexOf('@');
                    if (at >= 0) {
                        authority = authority.substring(at + 1);
                    }
                    int port = authority.indexOf(':');
                    if (port >= 0 && authority.indexOf(':', port + 1) < 0) {
                        authority = authority.substring(0, port);
                    }
                    host = authority.toLowerCase(Locale.ROOT);
                    while (host.endsWith(".")) {
                        host = host.substring(0, host.length() - 1);
                    }
                }
            }
        }
        return new Parts(raw, scheme, host);
    }

    private static boolean isSchemeToken(String token) {
        if (token.isEmpty()) {
            return false;
        }
        char first = token.charAt(0);
        if (!isAsciiLetter(first)) {
            return false;
        }
        for (int i = 1; i < token.length(); i++) {
            char c = token.charAt(i);
            if (!isAsciiLetter(c) && !isDigit(c) && c != '+' && c != '.' && c != '-') {
                return false;
            }
        }
        return true;
    }

    private static boolean isAsciiLetter(char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }

    private static boolean isDigit(char c) {
        return c >= '0' && c <= '9';
    }

    /** True when {@code host} equals an allowed host or is one of its sub-domains. */
    public static boolean isAllowedHost(String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        String h = host.toLowerCase(Locale.ROOT);
        for (String allowed : ALLOWED_HOSTS) {
            if (h.equals(allowed) || h.endsWith("." + allowed)) {
                return true;
            }
        }
        return false;
    }

    /** True for {@code http}/{@code https} URLs on an allowed host. */
    public static boolean isInternalHost(String url) {
        Parts p = parse(url);
        return ("http".equals(p.scheme) || "https".equals(p.scheme)) && isAllowedHost(p.host);
    }

    /** True when the URL may be rendered by the app WebView (https + allowed host). */
    public static boolean isInternalNavigable(String url) {
        Parts p = parse(url);
        return "https".equals(p.scheme) && isAllowedHost(p.host);
    }

    /** Rewrites an {@code http://} internal URL to {@code https://}; other input is returned as is. */
    public static String upgradeToHttps(String url) {
        Parts p = parse(url);
        if ("http".equals(p.scheme) && isAllowedHost(p.host)) {
            return "https://" + p.raw.substring("http://".length());
        }
        return url;
    }

    /** True for schemes that must stay inside the WebView (blob:, data:, about:, ...). */
    public static boolean isNonNavigableScheme(String url) {
        String scheme = parse(url).scheme;
        for (String s : NON_NAVIGABLE_SCHEMES) {
            if (s.equals(scheme)) {
                return true;
            }
        }
        return false;
    }

    /** True for schemes that belong to another Android app (mailto:, tel:, whatsapp:, intent:, ...). */
    public static boolean isExternalAppScheme(String url) {
        String scheme = parse(url).scheme;
        if (scheme.isEmpty() || "http".equals(scheme) || "https".equals(scheme)) {
            return false;
        }
        for (String s : EXTERNAL_APP_SCHEMES) {
            if (s.equals(scheme)) {
                return true;
            }
        }
        return false;
    }

    /** True for ordinary web links (http/https), internal or not. */
    public static boolean isWebUrl(String url) {
        Parts p = parse(url);
        return "http".equals(p.scheme) || "https".equals(p.scheme);
    }

    /** True for links that should be offered to the system (WhatsApp, Maps, mail, ...). */
    public static boolean shouldOpenExternally(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        if (isNonNavigableScheme(url)) {
            return false;
        }
        if (isInternalHost(url)) {
            return false;
        }
        return isWebUrl(url) || isExternalAppScheme(url) || !parse(url).scheme.isEmpty();
    }
}
