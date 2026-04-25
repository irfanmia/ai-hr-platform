from django.urls import path

from .views import DemoRequestCreateView

urlpatterns = [
    path("", DemoRequestCreateView.as_view(), name="demo-request-create"),
]
