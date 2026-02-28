from django.contrib import admin

# Register your models here.
from .models import User, University, Course, Batch, Subject
admin.site.register(User)
admin.site.register(University)
admin.site.register(Course)
admin.site.register(Batch)
admin.site.register(Subject)