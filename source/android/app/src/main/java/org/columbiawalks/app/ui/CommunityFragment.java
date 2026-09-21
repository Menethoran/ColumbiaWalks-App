package org.columbiawalks.app.ui;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;

/** Entry point for community resources and ColumbiaWalks app feedback. */
public final class CommunityFragment extends Fragment {
    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_community, container, false);
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);
        MainActivity activity = (MainActivity) requireActivity();
        view.findViewById(R.id.contact_call_robert)
                .setOnClickListener(button -> openContactIntent(
                        new Intent(
                                Intent.ACTION_DIAL,
                                Uri.parse("tel:7174669069")
                        )
                ));
        view.findViewById(R.id.contact_text_robert)
                .setOnClickListener(button -> openContactIntent(
                        new Intent(
                                Intent.ACTION_SENDTO,
                                Uri.parse("smsto:7174669069")
                        )
                ));
        view.findViewById(R.id.contact_private_message)
                .setOnClickListener(button -> activity.navigateToAppFeedback());
        view.findViewById(R.id.open_police_tip)
                .setOnClickListener(button -> activity.navigateToPoliceTip());
        view.findViewById(R.id.open_trash_cans)
                .setOnClickListener(button -> activity.navigateToTrashCans());
        view.findViewById(R.id.open_app_feedback)
                .setOnClickListener(
                        button -> activity.navigateToAppFeedback()
                );
    }

    private void openContactIntent(Intent intent) {
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.phone_app_unavailable,
                    Toast.LENGTH_LONG
            ).show();
        }
    }
}
