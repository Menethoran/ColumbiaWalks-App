package org.columbiawalks.app.domain;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ChecklistCatalog {
    private static final String ASSET_NAME = "checklist_catalog.json";

    private ChecklistCatalog() {
    }

    public static List<Category> load(Context context)
            throws IOException, JSONException {
        JSONObject root = new JSONObject(readAsset(context));
        JSONArray categoryValues = root.getJSONArray("categories");
        List<Category> categories = new ArrayList<>();
        for (int categoryIndex = 0;
             categoryIndex < categoryValues.length();
             categoryIndex++) {
            JSONObject categoryValue =
                    categoryValues.getJSONObject(categoryIndex);
            List<String> reportCategories = new ArrayList<>();
            JSONArray reportCategoryValues =
                    categoryValue.optJSONArray("report_categories");
            if (reportCategoryValues == null) {
                reportCategories.add(
                        categoryValue.getString("report_category")
                );
            } else {
                for (int reportCategoryIndex = 0;
                     reportCategoryIndex < reportCategoryValues.length();
                     reportCategoryIndex++) {
                    reportCategories.add(
                            reportCategoryValues.getString(
                                    reportCategoryIndex)
                    );
                }
            }
            JSONArray questionValues =
                    categoryValue.getJSONArray("questions");
            List<Question> questions = new ArrayList<>();
            for (int questionIndex = 0;
                 questionIndex < questionValues.length();
                 questionIndex++) {
                JSONObject questionValue =
                        questionValues.getJSONObject(questionIndex);
                questions.add(new Question(
                        questionValue.getString("id"),
                        questionValue.getString("text")
                ));
            }
            categories.add(new Category(
                    categoryValue.getString("id"),
                    categoryValue.getString("title"),
                    categoryValue.getString("description"),
                    categoryValue.getString("report_category"),
                    reportCategories,
                    questions
            ));
        }
        return Collections.unmodifiableList(categories);
    }

    private static String readAsset(Context context) throws IOException {
        try (InputStream input =
                     context.getAssets().open(ASSET_NAME);
             ByteArrayOutputStream output =
                     new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    public static final class Category {
        private final String id;
        private final String title;
        private final String description;
        private final String reportCategory;
        private final List<String> reportCategories;
        private final List<Question> questions;

        Category(
                String id,
                String title,
                String description,
                String reportCategory,
                List<String> reportCategories,
                List<Question> questions
        ) {
            this.id = id;
            this.title = title;
            this.description = description;
            this.reportCategory = reportCategory;
            this.reportCategories =
                    Collections.unmodifiableList(reportCategories);
            this.questions = Collections.unmodifiableList(questions);
        }

        public String getId() {
            return id;
        }

        public String getTitle() {
            return title;
        }

        public String getDescription() {
            return description;
        }

        public String getReportCategory() {
            return reportCategory;
        }

        public List<String> getReportCategories() {
            return reportCategories;
        }

        public boolean appliesTo(List<String> selectedCategories) {
            for (String reportCategoryValue : reportCategories) {
                if (selectedCategories.contains(reportCategoryValue)) {
                    return true;
                }
            }
            return false;
        }

        public List<Question> getQuestions() {
            return questions;
        }
    }

    public static final class Question {
        private final String id;
        private final String text;

        private Question(String id, String text) {
            this.id = id;
            this.text = text;
        }

        public String getId() {
            return id;
        }

        public String getText() {
            return text;
        }
    }
}

