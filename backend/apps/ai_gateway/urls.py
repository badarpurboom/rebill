from django.urls import path
from .views import (
    AIRootDirectoryView,
    AISalesSummaryView,
    AIDailyReportView,
    AITopProductsView,
    AITopCustomersView,
    AITextReportView,
    AISchemaView,
    AIRunQueryView,
    AIContextDailyView,
    AIDemandForecastView,
    # ── Safe CRUD views ──
    AICancelBillView,
    AIToggleMenuItemView,
    AIUpdateMenuPriceView,
    AIUpdateCustomerView,
    # ── Floor Map views ──
    AIGetAllTablesView,
    AIGetTableDetailView,
    AIUpdateTableStatusView,
    AIAddItemToOrderView,
    AIRemoveItemFromOrderView,
)

urlpatterns = [
    path('', AIRootDirectoryView.as_view(), name='ai-root-directory'),
    path('schema/', AISchemaView.as_view(), name='ai-schema'),
    path('query/', AIRunQueryView.as_view(), name='ai-query'),
    path('sales/summary/', AISalesSummaryView.as_view(), name='ai-sales-summary'),
    path('sales/daily/', AIDailyReportView.as_view(), name='ai-sales-daily'),
    path('products/top/', AITopProductsView.as_view(), name='ai-top-products'),
    path('customers/top/', AITopCustomersView.as_view(), name='ai-top-customers'),
    path('text-report/', AITextReportView.as_view(), name='ai-text-report'),
    path('context/daily/', AIContextDailyView.as_view(), name='ai-context-daily'),
    path('forecast/demand/', AIDemandForecastView.as_view(), name='ai-forecast-demand'),
    # ── Safe CRUD endpoints ──
    path('bills/cancel/', AICancelBillView.as_view(), name='ai-cancel-bill'),
    path('menu/toggle/', AIToggleMenuItemView.as_view(), name='ai-toggle-menu-item'),
    path('menu/price/', AIUpdateMenuPriceView.as_view(), name='ai-update-menu-price'),
    path('customers/update/', AIUpdateCustomerView.as_view(), name='ai-update-customer'),
    # ── Floor Map endpoints ──
    path('tables/', AIGetAllTablesView.as_view(), name='ai-get-all-tables'),
    path('tables/detail/', AIGetTableDetailView.as_view(), name='ai-get-table-detail'),
    path('tables/status/', AIUpdateTableStatusView.as_view(), name='ai-update-table-status'),
    path('tables/add-item/', AIAddItemToOrderView.as_view(), name='ai-add-item-to-order'),
    path('tables/remove-item/', AIRemoveItemFromOrderView.as_view(), name='ai-remove-item-from-order'),
]
