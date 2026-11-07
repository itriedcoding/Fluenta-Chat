package app.fluenta.xposed;

import android.app.Activity;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Launcher screen: explains how the module attaches and what it can do. */
public class StatusActivity extends Activity {

    private static final String TEXT =
            "Fluenta — Discord client mod (LSPosed)\n\n"
                    + "1. Enable this module in LSPosed Manager and scope it to Discord.\n"
                    + "2. Force stop Discord, then open it again.\n"
                    + "3. In LSPosed → Logs you should see \"Fluenta: hooks active\".\n\n"
                    + "What it does inside Discord:\n"
                    + "• clears FLAG_SECURE so screenshots and screen recording work\n"
                    + "• injects the Fluenta bundle into Discord's WebView surfaces\n"
                    + "• keeps every hook guarded, so a Discord update cannot crash the app\n\n"
                    + "What it cannot do: Discord's main UI is React Native on Hermes\n"
                    + "bytecode. Running the full JavaScript mod in that runtime needs a\n"
                    + "native bridge into libhermes.so, which is not part of this module.\n"
                    + "For the full mod UI without root, use the Fluenta WebView app.";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView text = new TextView(this);
        text.setText(TEXT);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        text.setLineSpacing(0f, 1.15f);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        text.setPadding(pad, pad, pad, pad);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(text, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout root = new LinearLayout(this);
        root.setGravity(Gravity.TOP);
        root.addView(scroll);
        setContentView(root);
    }
}
