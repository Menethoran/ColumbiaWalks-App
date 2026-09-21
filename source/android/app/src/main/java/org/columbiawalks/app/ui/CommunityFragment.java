package org.columbiawalks.app.ui;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

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
        view.findViewById(R.id.open_police_tip)
                .setOnClickListener(button -> activity.navigateToPoliceTip());
        view.findViewById(R.id.open_trash_cans)
                .setOnClickListener(button -> activity.navigateToTrashCans());
        view.findViewById(R.id.open_app_feedback)
                .setOnClickListener(
                        button -> activity.navigateToAppFeedback()
                );
    }
}
