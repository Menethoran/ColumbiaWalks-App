package org.columbiawalks.app.ui;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import org.columbiawalks.app.R;

public final class PermissionsRationaleActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdgeSupport.enable(this);
        setContentView(R.layout.activity_permissions_rationale);
        EdgeToEdgeSupport.applySystemBarPadding(
                findViewById(R.id.permissions_root)
        );
        findViewById(R.id.permissions_close).setOnClickListener(view -> finish());
    }
}
