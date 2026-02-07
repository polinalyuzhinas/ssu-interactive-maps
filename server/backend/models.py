from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

#todo: foreign keys

class lessons_in_schedule(models.Model):
    SUBGROUP_VARIANTS = [
        (None, "Вся группа"), 
        (1, "1"), 
        (2, "2"), 
        (3, "3"),
    ]

    DAYS_ON_WEEK = [
        (1, "Понедельник"),
        (2, "Вторник"),
        (3, "Среда"),
        (4, "Четверг"),
        (5, "Пятница"),
        (6, "Суббота"),
    ]

    LESSON_TYPES = [
        (0, "Практика"),
        (1, "Лекция"),
        (2, "Лабораторная"),
    ]

    LESSON_PARITY = [
        (None, "-"),
        (True, "Числитель"),
        (False, "Знаменатель"),
    ]

    LESSON_TIME = [
        (1, "8:20-9:50"),
        (2, "10:00-11:35"),
        (3, "12:05-13:40"),
        (4, "13:50-15:25"),
        (5, "15:35-17:10"),
        (6, "17:20-18:40"),
        (7, "18:45-20:05"),
        (8, "20:10-21:30")
    ]

    lesson = models.IntegerField(required=True)
    auditorium = models.IntegerField(null=True)
    subgroup = models.SmallIntegerField(null=True, choices=SUBGROUP_VARIANTS, default=None)
    week_day = models.SmallIntegerField(choices=DAYS_ON_WEEK, required=True)
    time = models.SmallIntegerField(choices=LESSON_TIME, required=True)
    lesson_type = models.SmallIntegerField(choices=LESSON_TYPES, default=0)
    parity = models.BooleanField(choices=LESSON_PARITY, null=True, default=None)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class lessons(models.Model):
    
    name = models.TextField(max_length = 255, required=True)
    teacher = models.IntegerField(null=True)
    faculty = models.IntegerField(required=True)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class groups(models.Model):
    
    GROUPS_TYPES = [
        (0, "Бакалавриат"),
        (1, "Специалитет"),
        (2, "Магистратура"),
        (3, "Аспирантура"),
    ]

    EDU_FORMS = [
        (0, "Очное"),
        (1, "Заочное"),
        (2, "Очно-заочное"),
        (3, "Вечернее")
    ]

    number = models.IntegerField(required=True)
    faculty = models.IntegerField(required=True)
    group_type = models.SmallIntegerField(choice=GROUPS_TYPES, default=0) # возможно будет удалено в окончательной версии
    form = models.SmallIntegerField(choice=EDU_FORMS, default=0) # возможно будет удалено в окончательной версии

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class groups_schedule(models.Model):
    
    group = models.IntegerField(required=True)
    lesson = models.IntegerField(required=True)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class faculties(models.Model):
    
    short_name = models.TextField(max_length=15, null=True, unique=True)
    full_name = models.TextField(max_length=255, unique=True, required=True)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class faculty_teachers(models.Model):
    
    faculty = models.IntegerField(required=True)
    surname = models.TextField(required=True, max_length=255)
    name = models.TextField(required=True, max_length=255)
    patronymic = models.TextField(null=True, max_length=255)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class auditoriums(models.Model):
    
    number = models.IntegerField(primary_key=True, editable=True)
    floor = models.SmallIntegerField(required=True, validators=[MinValueValidator(1),MaxValueValidator(7),])
    auditorium_type = models.IntegerField(null=True, default=None)
    have_lessons = models.BooleanField(default=False)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    
class auditorium_types(models.Model): # возможно будет удалено как отдельное отношение
    
    name = models.TextField(max_lenght = 255, required = True)

    def __str__(self): # todo: красивенький вывод отношения
        pass
    