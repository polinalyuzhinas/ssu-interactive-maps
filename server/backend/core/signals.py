# your_app/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Lessons_Schedule, Auditoriums

@receiver([post_save, post_delete], sender=Lessons_Schedule)
def update_auditorium_lessons_status(sender, instance, **kwargs):
    auditorium = instance.auditorium
    
    if auditorium:
        has_lessons = Lessons_Schedule.objects.filter(auditorium=auditorium).exists()
        
        if auditorium.have_lessons != has_lessons:
            Auditoriums.objects.filter(pk=auditorium.pk).update(have_lessons=has_lessons)