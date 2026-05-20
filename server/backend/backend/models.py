from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

# идеи: 
# сделать не просто базу данных о текущем расписании, но и 
# вспомогательный инструмент для составления расписания: 
# предупреждать, когда на текущее время аудитория занята 
# или когда преподаватель или группа заняты


class Faculties(models.Model):
    short_name = models.TextField(max_length=15, unique=True, help_text="Аббревиатура")
    full_name = models.TextField(max_length=255, unique=True, null=True, help_text="Полное название")

    def __str__(self):
        return f"[id: {self.id}] В XII корпусе есть пары от факультета {self.full_name} {f'(сокращённо {self.short_name})' if self.short_name else ''}"
    

class Faculty_Teachers(models.Model):
    faculty = models.ForeignKey(Faculties, on_delete=models.RESTRICT)
    surname = models.TextField(max_length=255, help_text="Фамилия преподавателя")
    name = models.TextField(max_length=255, help_text="Имя преподавателя")
    patronymic = models.TextField(null=True, max_length=255, blank=True, help_text="Отчество преподавателя (если есть)")

    def __str__(self):
       return f"[id: {self.id}] Преподаватель {self.surname} {self.name} {self.patronymic if self.patronymic else ''} преподаёт пары на факультете {self.faculty}"


class Lessons(models.Model):
    name = models.TextField(max_length = 255, help_text="Название пары")
    assigment = models.ForeignKey(Faculty_Teachers, on_delete=models.RESTRICT, help_text="Прикрепляется запись преподаватель-факультет для этой пары")

    def __str__(self):
        return f"[id: {self.id}] Пара с названием {self.name} на факультете {self.faculty}, препопадаватель {'' + (self.teacher) if self.teacher else 'не назначен'}"
    

class Groups(models.Model):
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

    number = models.IntegerField(help_text="Номер группы")
    faculty = models.ForeignKey(Faculties, on_delete=models.RESTRICT)
    group_type = models.SmallIntegerField(choices=GROUPS_TYPES, default=0, blank=True, help_text="Бакалавриат, специалитет, магистратура или аспирантура") # возможно будет удалено в окончательной версии
    form = models.SmallIntegerField(choices=EDU_FORMS, default=0, blank=True, help_text="Очное, заочное, очно-заочное или вечернее") # возможно будет удалено в окончательной версии

    def __str__(self):
        return f"[id: {self.id}] Группа с номером {self.number}, факультет {self.faculty}, {self.group_type}, {self.form}"
    

class Groups_Schedule(models.Model):
    group = models.ForeignKey(Groups, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lessons, on_delete=models.CASCADE)

    def __str__(self):
        return f"[id: {self.id}] Для группы {self.group} проводится пара {self.lesson}"
    

class Auditorium_Types(models.Model): # возможно будет удалено как отдельное отношение
    name = models.TextField(max_length = 255, help_text="Название типа")

    def __str__(self):
        return f"[id: {self.id}] Тип аудитории {self.name}"
    

class Auditoriums(models.Model):
    number = models.IntegerField(primary_key=True, editable=True, help_text="Номер аудитории")
    floor = models.SmallIntegerField(validators=[MinValueValidator(1),MaxValueValidator(7),], help_text="Номер этажа")
    auditorium_type = models.ForeignKey(Auditorium_Types, on_delete=models.SET_NULL, null=True)
    have_lessons = models.BooleanField(default=False, editable=False) # это поле недоступно для ввода (меняют только триггеры)

    def __str__(self):
        return f"[id: {self.id}] Комната {self.number}, этаж {self.floor}, {self.type if self.type else ''}, пары {'' if self.have_lessons else 'не'} проводятся"
    

class Lessons_Schedule(models.Model):
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

    lesson = models.ForeignKey(Lessons, on_delete=models.RESTRICT)
    auditorium = models.ForeignKey(Auditoriums, on_delete=models.SET_NULL, null=True)
    subgroup = models.SmallIntegerField(null=True, choices=SUBGROUP_VARIANTS, default=None, blank=True, help_text="Подгруппа")
    week_day = models.SmallIntegerField(choices=DAYS_ON_WEEK, default="1", help_text="Номер дня недели")
    time = models.SmallIntegerField(choices=LESSON_TIME, help_text="Номер пары")
    lesson_type = models.SmallIntegerField(choices=LESSON_TYPES, default=0, help_text="Практика, лекция или лабораторная")
    parity = models.BooleanField(choices=LESSON_PARITY, null=True, default=None, blank=True, help_text="Числитель или знаменатель")

    def __str__(self):
        return f"[id: {self.id}] {self.week_day}, {self.time} пара: Пара {self.lesson}, комната {self.auditorium}, для {f'{self.subgroup} подгруппы' if self.subgroup else 'всей группы'}, {self.type}, {self.parity if self.parity else ''}"
    
