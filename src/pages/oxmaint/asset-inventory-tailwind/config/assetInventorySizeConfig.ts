export const assetInventorySizeConfig = {
    pageTitleFontSize: '1.25rem',
    statusCard: {
        width: 208,
        padding: 12,
        borderRadius: 12,
        headerFontSize: 12,
        iconSize: 32,
        iconFontSize: 16,
        countFontSize: 22,
        descriptionFontSize: 11
    },
    grid: {
        rowHeight: 40,
        headerHeight: 40
    },
    dialog: {
        borderRadius: 5,
        headerPadding: '10px 14px',
        headerFontSize: '0.95rem',
        actionButtonFontSize: '0.82rem'
    },
    form: {
        gridSpacing: 1.5,
        sectionPadding: 1.5,
        fieldSpacing: 0.75,
        sectionTitleFontSize: 14,
        selectedItemFontSize: 13,
        helperFontSize: 12,
        dialogListMaxHeight: 330
    }
} as const;

export const assetInventorySizeCssVars = {
    '--ai-toolbar-gap': '8px',
    '--ai-toolbar-btn-height': '32px',
    '--ai-toolbar-btn-radius': '10px',
    '--ai-toolbar-btn-padding': '0 12px',
    '--ai-toolbar-btn-font': '13px',
    '--ai-search-height': '32px',
    '--ai-search-min-width': '250px',
    '--ai-search-padding': '0 10px',
    '--ai-search-font': '13px',
    '--ai-icon-btn-font': '18px',
    '--ai-grid-header-font': '13px',
    '--ai-grid-cell-font': '13px',
    '--ai-action-btn-radius': '10px',
    '--ai-action-btn-padding': '2px 10px',
    '--ai-action-btn-margin': '2px 4px',
    '--ai-action-btn-font': '12px',
    '--ai-icon-bubble-size': '34px',
    '--ai-icon-bubble-font': '16px',
    '--ai-badge-font': '10px',
    '--ai-status-pill-padding': '1px 8px',
    '--ai-status-pill-margin': '2px 0',
    '--ai-status-pill-radius': '999px',
    '--ai-status-pill-font': '10px'
} as const;
