---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/18-safe-configuration-examples.md"
---

# Safe Configuration Examples

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

All identities, sources and rows below are synthetic. These are **schema fragments**, not a complete working runtime configuration. Replace placeholders privately, combine with the required application sections and validate against the new implementation. None is an invitation to overwrite existing configuration.

## Global policy fragment

```json
{
  "auth": { "allowed_email_domains": ["example.com"] },
  "data_lag_days": 3,
  "metric_availability": {
    "date_basis": "cohort_start",
    "reporting_lag_days": 0,
    "lag_days": { "R7": 9 }
  }
}
```

## Project and consolidated document fragment

```json
{
  "timeline_document_source": {
    "url": "https://docs.google.com/spreadsheets/d/REPLACE_WITH_INDEX_ID/edit",
    "header_row": 1
  },
  "sheets": [
    {
      "name": "Project Alpha",
      "latte_key": "Alpha Upstream",
      "enabled": true,
      "read_mode": "cohort_tabs",
      "url": "https://docs.google.com/spreadsheets/d/REPLACE_WITH_FALLBACK_ID/edit",
      "tab": "Legacy Data",
      "header_row": 1,
      "cohort_tabs": {
        "url": "https://docs.google.com/spreadsheets/d/REPLACE_WITH_COHORT_ID/edit",
        "header_row": 1,
        "tabs": {
          "core_player": "Core Player",
          "new_player": "New Player",
          "revival_7_player": "Revival 7 Player",
          "tiered_player_engagement": "Tiered Player Engagement"
        }
      },
      "document": {
        "url": "https://docs.google.com/spreadsheets/d/REPLACE_WITH_ORIGINAL_DOC_ID/edit",
        "tab": "Change Logs",
        "timeline_tab": "Project Alpha",
        "header_row": 1
      }
    },
    {
      "name": "Project Beta",
      "enabled": true,
      "read_mode": "legacy",
      "url": "",
      "tab": "",
      "header_row": 1,
      "document": {
        "url": "https://docs.google.com/spreadsheets/d/REPLACE_WITH_BETA_DOC_ID/edit",
        "tab": "Change Logs",
        "header_row": 1
      }
    }
  ]
}
```

Project Beta is document-only. These placeholder IDs are intentionally not real deployment sources and may fail runtime source validation until replaced. The original document remains the write target even when the index is configured.

## Per-user access fragment

```json
{
  "access_version": 2,
  "groups": [
    { "name": "Staff", "kind": "staff", "color": "#60a5fa" },
    { "name": "Collaborators", "kind": "collaborator", "color": "#2dd4bf" },
    { "name": "QA", "kind": "collaborator", "color": "#fbbf24" }
  ],
  "permissions": [
    {
      "group": "Staff",
      "can_edit_document": true,
      "can_edit_calendar": false,
      "calendar_all": false,
      "official_maps": true,
      "can_view_user_counts": true
    },
    {
      "group": "Collaborators",
      "can_edit_document": true,
      "can_edit_calendar": false,
      "calendar_all": false,
      "official_maps": false,
      "can_view_user_counts": false
    },
    {
      "group": "QA",
      "can_edit_document": true,
      "can_edit_calendar": true,
      "calendar_all": true,
      "official_maps": false,
      "can_view_user_counts": false
    }
  ],
  "users": [
    {
      "email": "staff@example.com",
      "groups": ["Staff"],
      "sheets": ["Project Alpha"],
      "regions": "*",
      "excluded_regions": ["IND"],
      "sheet_reader": "user"
    },
    {
      "email": "qa@example.com",
      "groups": ["QA"],
      "sheets": ["Project Alpha"],
      "regions": ["VN"],
      "excluded_regions": [],
      "sheet_reader": "shared"
    }
  ]
}
```

The administrator bootstrap/identity and shared-reader account are intentionally omitted; configure them privately for the new installation. This fragment is not intended to pass the reference server's live administrator-preservation checks. QA above has all-project date editing but only assigned-project content/performance access.

## Weighted metric fragment

```json
{
  "name": "Avg R2",
  "source_column": "R2",
  "calculation": "weighted_avg",
  "weight_column": "DAU",
  "format": "percent"
}
```

Only if source survival is seconds:

```json
{
  "name": "Avg Survival Time (Minutes)",
  "source_column": "Avg Survival Time",
  "calculation": "weighted_avg",
  "weight_column": "DAU",
  "format": "decimal_1",
  "transform": { "operation": "divide", "value": 60 }
}
```

## Combined chart fragment

```json
{
  "id": "alpha_dau_r2",
  "title": "DAU & R2",
  "height": 250,
  "axes": {
    "left": { "title": "Users", "format": "number" },
    "right": { "title": "R2", "format": "percent" }
  },
  "series": [
    {
      "label": "DAU",
      "data_column": "DAU",
      "type": "bar",
      "axis": "left",
      "color": "rgba(99,102,241,.65)",
      "format": "number"
    },
    {
      "label": "R2",
      "data_column": "Avg R2",
      "type": "line",
      "axis": "right",
      "color": "rgba(20,184,166,.9)",
      "format": "percent"
    }
  ]
}
```

Column names here assume a compatible aggregated table. Privacy normalization must happen before render/export. Event annotations are populated from authorized document data, not hard-coded update dates.

## Disabled snapshot job fragment

```json
{
  "id": "example_weekly_all",
  "name": "Example Weekly All",
  "enabled": false,
  "snapshot_type": "weekly_all_projects",
  "projects": ["Project Alpha"],
  "seatalk_group_ids": [],
  "schedule": {
    "enabled": false,
    "mode": "daily",
    "time": "09:00",
    "timezone": "Asia/Bangkok",
    "weekdays": [1]
  }
}
```

No webhook/group credential is included. Configure a destination privately and obtain explicit authorization before enabling or testing delivery.

## Synthetic comparison payload

```json
{
  "project": "Project Alpha",
  "current": { "start": "2026-08-10", "end": "2026-08-16" },
  "previous": { "start": "2026-08-03", "end": "2026-08-09" },
  "metrics": {
    "overall_r2": { "previous": 0.25, "current": 0.27, "delta_pp": 2.0 },
    "survival_minutes": { "previous": 18.0, "current": 19.5, "delta": 1.5 },
    "match_count": { "previous": 2.3, "current": 2.5, "delta": 0.2 }
  },
  "coverage": { "current_days": 7, "previous_days": 7, "expected_days": 7 },
  "counts_visible": false
}
```

This is an illustrative analysis contract, not an exact response from a specific API. It intentionally contains no population weights or absolute user counts.
