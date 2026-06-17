# cигналы Django ORM: post_save срабатывает после сохранения объекта, а post_delete сразу после удаления объекта
from django.db.models.signals import post_save, post_delete
# декоратор @receiver для регистрации функции как обработчика сигнала
from django.dispatch import receiver
# модели
from .models import Lessons_Schedule, Auditoriums

# =============================================================================
# сигнал: Автоматическое обновление флага наличия пар в аудитории
# =============================================================================
# Назначение:
#   Поддерживает поле Auditoriums.have_lessons в актуальном состоянии.
#   Это поле-маркер или поле-флаг, как угодно, показывающее, проводятся 
#   ли в аудитории какие-либо пары. 
#   Используется в админке для визуальной индикации
#   (отображается как disabled-чекбокс).
#
# Когда срабатывает:
#   - При создании новой записи Lessons_Schedule (новая пара в расписании)
#   - При редактировании существующей записи (например, смена аудитории)
#   - При удалении записи из расписания
# =============================================================================
@receiver([post_save, post_delete], sender=Lessons_Schedule)
def update_auditorium_lessons_status(sender, instance, **kwargs):
    auditorium = instance.auditorium
    
    if auditorium:
        has_lessons = Lessons_Schedule.objects.filter(auditorium=auditorium).exists()
        
        if auditorium.have_lessons != has_lessons:
            Auditoriums.objects.filter(pk=auditorium.pk).update(have_lessons=has_lessons)