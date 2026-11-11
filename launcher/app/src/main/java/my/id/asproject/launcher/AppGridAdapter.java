package my.id.asproject.launcher;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Adaptor kisi aplikasi beranda. */
public final class AppGridAdapter extends BaseAdapter {

    private final LayoutInflater inflater;
    private final IconLoader icons;
    private final List<AppItem> items = new ArrayList<AppItem>();
    private boolean showLabels;

    public AppGridAdapter(Context context, IconLoader icons, boolean showLabels) {
        this.inflater = LayoutInflater.from(context);
        this.icons = icons;
        this.showLabels = showLabels;
    }

    public void setItems(List<AppItem> items) {
        this.items.clear();
        this.items.addAll(items);
        notifyDataSetChanged();
    }

    public void setShowLabels(boolean showLabels) {
        if (this.showLabels != showLabels) {
            this.showLabels = showLabels;
            notifyDataSetChanged();
        }
    }

    @Override
    public int getCount() {
        return items.size();
    }

    @Override
    public AppItem getItem(int position) {
        return items.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View view = convertView;
        if (view == null) {
            view = inflater.inflate(R.layout.item_app, parent, false);
        }
        AppItem item = items.get(position);
        ImageView icon = (ImageView) view.findViewById(R.id.appIcon);
        TextView label = (TextView) view.findViewById(R.id.appLabel);

        icon.setImageBitmap(icons.get(item));
        label.setText(item.label);
        label.setVisibility(showLabels ? View.VISIBLE : View.GONE);
        return view;
    }
}
