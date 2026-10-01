"""urls.py - which address goes to which function in poll/views.py.

These are the same addresses the Flask version had, so the React frontend doesn't change.
"""
from django.urls import path, re_path

from poll import views

urlpatterns = [
    # The website (built React app)
    path("", views.home),

    # Poll
    path("scenarios", views.scenarios),   # GET  all scenarios
    path("response", views.response),     # POST one answer
    path("results", views.results),       # GET  vote counts and timing per scenario

    # Scenario designer (needs the X-Admin-Token header)
    path("admin/check", views.admin_check),                          # GET    is the token right?
    path("admin/scenarios", views.admin_create_scenario),            # POST   create
    path("admin/scenarios/<str:scenario_id>", views.admin_scenario),  # PUT    replace, DELETE delete

    # Any other address: a file from the built site (JavaScript, CSS, icons, sample data)
    re_path(r"^(?P<path>.+)$", views.frontend_file),
]
