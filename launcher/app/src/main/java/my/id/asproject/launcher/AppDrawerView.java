package my.id.asproject.launcher;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.animation.DecelerateInterpolator;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * **Laci aplikasi** — panel kaca cair yang meluncur dari bawah berisi SEMUA
 * aplikasi, dengan liquid slide bar ({@link LiquidHandleView}) di puncaknya.
 *
 * Cara membuka: geser ke atas di area kosong beranda (atau dari dock). Cara
 * menutup: tarik gagang ke bawah, geser ke bawah saat kisi berada di posisi
 * paling atas, atau tombol Kembali.
 *
 * Saat laci bergerak, {@link Listener#onProgress(float)} memberi tahu
 * LauncherActivity agar beranda ikut menyusut & memudar — itulah "efek scroll"
 * halaman utama.
 */
public final class AppDrawerView extends FrameLayout {

    /** Kabar ke Activity: kemajuan buka-tutup laci. */
    public interface Listener {
        /** @param progress 0 = tertutup, 1 = terbuka penuh. */
        void onProgress(float progress);

        void onOpened();

        void onClosed();

        void onAppClick(AppItem item);

        boolean onAppLongClick(AppItem item);
    }

    private final int touchSlop;

    private Listener listener;
    private View panel;
    private LiquidHandleView handle;
    private EditText search;
    private ImageView clearButton;
    private GridView grid;
    private TextView emptyView;

    private AppGridAdapter adapter;
    private final List<AppItem> allApps = new ArrayList<AppItem>();

    private boolean open;
    private boolean dragging;
    private float dragStartY;
    private float dragStartProgress;
    private VelocityTracker velocity;
    private ValueAnimator animator;
    private float progress;

    public AppDrawerView(Context context) {
        this(context, null);
    }

    /** Dipakai saat di-inflate dari XML. */
    public AppDrawerView(Context context, AttributeSet attrs) {
        super(context, attrs);
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
        setVisibility(GONE);
        setClickable(true);
        inflate(context, R.layout.view_app_drawer, this);
    }

    @Override
    protected void onFinishInflate() {
        super.onFinishInflate();
        panel = findViewById(R.id.drawerPanel);
        handle = (LiquidHandleView) findViewById(R.id.drawerHandle);
        search = (EditText) findViewById(R.id.drawerSearch);
        clearButton = (ImageView) findViewById(R.id.drawerClear);
        grid = (GridView) findViewById(R.id.drawerGrid);
        emptyView = (TextView) findViewById(R.id.drawerEmpty);
        Typefaces.apply(getContext(), this);

        grid.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                AppItem item = adapter.getItem(position);
                if (listener != null && item != null) {
                    listener.onAppClick(item);
                }
            }
        });
        grid.setOnItemLongClickListener(new AdapterView.OnItemLongClickListener() {
            @Override
            public boolean onItemLongClick(AdapterView<?> parent, View view, int position, long id) {
                AppItem item = adapter.getItem(position);
                return listener != null && item != null && listener.onAppLongClick(item);
            }
        });

        search.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                applyFilter(s.toString());
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
        clearButton.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View view) {
                search.setText("");
            }
        });

        // Efek scroll isi laci: header menyusut & gagang beriak saat kisi digulir.
        grid.setOnScrollListener(new android.widget.AbsListView.OnScrollListener() {
            private int lastFirst = -1;

            @Override
            public void onScrollStateChanged(android.widget.AbsListView view, int scrollState) {
                if (scrollState == SCROLL_STATE_FLING || scrollState == SCROLL_STATE_TOUCH_SCROLL) {
                    if (handle != null) {
                        handle.pulse();
                    }
                }
            }

            @Override
            public void onScroll(android.widget.AbsListView view, int firstVisibleItem,
                                 int visibleItemCount, int totalItemCount) {
                if (lastFirst >= 0 && firstVisibleItem != lastFirst && handle != null) {
                    handle.setStretch(0f);
                }
                lastFirst = firstVisibleItem;
            }
        });
    }

    // ------------------------------------------------------------------ data

    public void attach(AppGridAdapter gridAdapter) {
        this.adapter = gridAdapter;
        grid.setAdapter(gridAdapter);
    }

    public void setItems(List<AppItem> items) {
        allApps.clear();
        allApps.addAll(items);
        applyFilter(search == null ? "" : search.getText().toString());
    }

    public void setColumns(int columns) {
        grid.setNumColumns(columns);
    }

    public void setShowLabels(boolean showLabels) {
        if (adapter != null) {
            adapter.setShowLabels(showLabels);
        }
    }

    /** Terapkan gaya liquid slide bar yang dipilih pengguna di Pengaturan. */
    public void setHandleStyle(String style) {
        if (handle != null) {
            handle.setStyle(style);
        }
    }

    private void applyFilter(String query) {
        if (adapter == null) {
            return;
        }
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<AppItem> visible = new ArrayList<AppItem>();
        for (int i = 0; i < allApps.size(); i++) {
            AppItem item = allApps.get(i);
            if (needle.length() == 0 || item.label.toLowerCase(Locale.ROOT).contains(needle)) {
                visible.add(item);
            }
        }
        adapter.setItems(visible);
        emptyView.setVisibility(visible.isEmpty() ? VISIBLE : GONE);
        clearButton.setVisibility(needle.length() == 0 ? INVISIBLE : VISIBLE);
    }

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    // -------------------------------------------------------- buka & tutup

    public boolean isOpen() {
        return open;
    }

    public void open() {
        if (open) {
            return;
        }
        open = true;
        setVisibility(VISIBLE);
        setProgress(0f, true);
        if (handle != null) {
            handle.pulse();
        }
        animateTo(1f);
    }

    public void close() {
        if (!open) {
            return;
        }
        open = false;
        hideKeyboard();
        if (handle != null) {
            handle.pulse();
        }
        animateTo(0f);
    }

    private void animateTo(float target) {
        if (animator != null) {
            animator.cancel();
        }
        animator = ValueAnimator.ofFloat(progress, target);
        animator.setDuration(260L);
        animator.setInterpolator(new DecelerateInterpolator());
        animator.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override
            public void onAnimationUpdate(ValueAnimator animation) {
                setProgress((Float) animation.getAnimatedValue(), true);
            }
        });
        animator.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                if (open) {
                    if (listener != null) {
                        listener.onOpened();
                    }
                } else {
                    setVisibility(GONE);
                    if (listener != null) {
                        listener.onClosed();
                    }
                }
            }
        });
        animator.start();
    }

    /** Geser laci: 0 = tersembunyi di bawah, 1 = menutupi seluruh layar. */
    private void setProgress(float value, boolean notify) {
        progress = Math.max(0f, Math.min(1f, value));
        float height = getHeight();
        if (height <= 0f) {
            height = getResources().getDisplayMetrics().heightPixels;
        }
        setTranslationY(height * (1f - progress));
        if (panel != null) {
            panel.setAlpha(Math.max(0f, Math.min(1f, progress * 1.6f)));
            // Sedikit membesar saat terbuka penuh — kesan "mengambang".
            float scale = 0.96f + 0.04f * progress;
            panel.setScaleX(scale);
            panel.setScaleY(scale);
        }
        if (notify && listener != null) {
            listener.onProgress(progress);
        }
    }

    public float getProgress() {
        return progress;
    }

    // --------------------------------------------------------------- sentuh

    /** Benarkah kisi sedang berada di posisi paling atas (belum digulir)? */
    private boolean gridAtTop() {
        if (grid == null || grid.getChildCount() == 0) {
            return true;
        }
        return grid.getFirstVisiblePosition() == 0 && grid.getChildAt(0).getTop() >= 0;
    }

    private boolean inHandleArea(MotionEvent event) {
        return handle != null && panel != null
                && event.getY() <= panel.getTop() + handle.getHeight() * 1.6f;
    }

    @Override
    public boolean onInterceptTouchEvent(MotionEvent event) {
        if (!open) {
            return false;
        }
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                dragStartY = event.getY();
                dragging = false;
                break;
            case MotionEvent.ACTION_MOVE:
                if (!dragging) {
                    float dy = event.getY() - dragStartY;
                    // Seret hanya bila gerak ke bawah dan kisi belum digulir,
                    // atau bila sentuhan mulai di area gagang.
                    if ((dy > touchSlop && gridAtTop()) || (inHandleArea(event) && Math.abs(dy) > touchSlop)) {
                        dragging = true;
                        dragStartProgress = progress;
                        if (velocity == null) {
                            velocity = VelocityTracker.obtain();
                        } else {
                            velocity.clear();
                        }
                        velocity.addMovement(event);
                        return true;
                    }
                }
                break;
            default:
                break;
        }
        return super.onInterceptTouchEvent(event);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (!open) {
            return false;
        }
        if (velocity == null) {
            velocity = VelocityTracker.obtain();
        }
        velocity.addMovement(event);

        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                if (!inHandleArea(event) && !gridAtTop()) {
                    return false;
                }
                dragStartY = event.getY();
                dragStartProgress = progress;
                dragging = true;
                return true;

            case MotionEvent.ACTION_MOVE:
                if (!dragging) {
                    return false;
                }
                float height = getHeight();
                if (height <= 0f) {
                    height = getResources().getDisplayMetrics().heightPixels;
                }
                float dy = event.getY() - dragStartY;
                float next = dragStartProgress - dy / height;
                // Tarik melebihi batas → tepi cair melengkung.
                float overshoot = next > 1f ? Math.min(1f, (next - 1f) * 6f) : 0f;
                if (handle != null) {
                    handle.setStretch(overshoot);
                }
                setProgress(next, true);
                return true;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (!dragging) {
                    return false;
                }
                dragging = false;
                if (handle != null) {
                    handle.setStretch(0f);
                }
                velocity.computeCurrentVelocity(1000);
                float vy = velocity.getYVelocity();
                if (velocity != null) {
                    velocity.recycle();
                    velocity = null;
                }
                boolean shouldOpen = progress > 0.45f || vy < -900f;
                if (vy > 1400f) {
                    shouldOpen = false;
                }
                open = shouldOpen;
                if (!shouldOpen) {
                    hideKeyboard();
                }
                animateTo(shouldOpen ? 1f : 0f);
                return true;

            default:
                return dragging;
        }
    }

    private void hideKeyboard() {
        if (search != null) {
            search.clearFocus();
            InputMethodManager manager = (InputMethodManager) getContext()
                    .getSystemService(Context.INPUT_METHOD_SERVICE);
            if (manager != null) {
                manager.hideSoftInputFromWindow(search.getWindowToken(), 0);
            }
        }
    }

    /** Kosongkan kotak pencarian (dipakai saat laci dibuka ulang). */
    public void clearSearch() {
        if (search != null) {
            search.setText("");
        }
    }
}
