from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

# идеи: 
# сделать не просто базу данных о текущем расписании, но и 
# вспомогательный инструмент для составления расписания: 
# предупреждать, когда на текущее время аудитория занята 
# или когда преподаватель или группа заняты


class Faculties(models.Model):
    full_name = models.TextField(verbose_name="Название", max_length=255, editable=False, default=None, unique=True, help_text="Полное название")
    short_name = models.TextField(verbose_name="Аббревиатура", max_length=15, editable=False, null=True, blank=True, help_text="Аббревиатура (если полное название длинное)")

    def __str__(self):
        return self.short_name if self.short_name else self.full_name
    
    class Meta:
        verbose_name = "Факультет"
        verbose_name_plural = "Факультеты"


class Faculty_Teachers(models.Model):
    faculty = models.ForeignKey(Faculties, verbose_name="Факультет", editable=True, on_delete=models.RESTRICT, null=True, blank=True)
    surname = models.TextField(verbose_name="Фамилия", max_length=255, editable=True, help_text="Фамилия преподавателя")
    name = models.TextField(verbose_name="Имя",max_length=255, editable=True, help_text="Имя преподавателя")
    patronymic = models.TextField(verbose_name="Отчество", null=True, max_length=255, editable=True, blank=True, help_text="Отчество преподавателя (если есть)")

    def __str__(self):
       return f"[id: {self.pk}] {self.surname} {self.name} {self.patronymic if self.patronymic else ''} ({self.faculty})"

    class Meta:
        verbose_name = "Преподаватель"
        verbose_name_plural = "Преподаватели"


class Lessons(models.Model):
    LESSON_TYPES = [
        (0, "Практика"),
        (1, "Лекция"),
        (2, "Лабораторная"),
    ]

    name = models.TextField(verbose_name="Название", editable=True, max_length = 400, help_text="Название пары")
    assignment = models.ForeignKey(Faculty_Teachers, verbose_name="Назначен", editable=True, null=True, blank=True, on_delete=models.RESTRICT, help_text="Прикрепляется запись преподаватель-факультет для этой пары")
    lesson_type = models.SmallIntegerField(verbose_name="Тип", editable=True, choices=LESSON_TYPES, default=0, help_text="Практика, лекция или лабораторная")

    def __str__(self):
        assignment_str = str(self.assignment) if self.assignment else 'не назначен'
        return f"[id: {self.pk}] {self.name}, {assignment_str}"
    
    class Meta:
        verbose_name = "Пара"
        verbose_name_plural = "Пары"


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

    number = models.IntegerField(verbose_name="Номер", editable=True, help_text="Номер группы")
    faculty = models.ForeignKey(Faculties, verbose_name="Факультет", editable=True, on_delete=models.RESTRICT)
    group_type = models.SmallIntegerField(verbose_name="Вид", editable=True, choices=GROUPS_TYPES, default=0, blank=True, help_text="Бакалавриат, специалитет, магистратура или аспирантура") # возможно будет удалено в окончательной версии
    form = models.SmallIntegerField(verbose_name="Форма", editable=True, choices=EDU_FORMS, default=0, blank=True, help_text="Очное, заочное, очно-заочное или вечернее") # возможно будет удалено в окончательной версии

    def __str__(self):
        return f"[id: {self.pk}] Группа {self.number} {self.faculty} {self.group_type} {self.form}"
    
    class Meta:
        verbose_name = "Группа"
        verbose_name_plural = "Группы"
        constraints = [
            models.UniqueConstraint(
                fields=['number', 'group_type', 'form', 'faculty'],
                name='unique_group_per_faculty'
            )
        ]

class Groups_Schedule(models.Model):
    group = models.ForeignKey(Groups, editable=True, verbose_name="Группа", on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lessons, editable=True, verbose_name="Пара", on_delete=models.CASCADE)

    def __str__(self):
        return f"[id: {self.pk}] {self.group} {self.lesson}"
    
    class Meta:
        verbose_name = "Пара по группам"
        verbose_name_plural = "Пары по группам"
    

class Auditorium_Types(models.Model):
    name = models.TextField(verbose_name="Тип", editable=False, max_length = 255, help_text="Название типа")

    def __str__(self):
        return f"[id: {self.pk}] {self.name}"
    
    class Meta:
        verbose_name = "Вид аудиторий"
        verbose_name_plural = "Виды аудиторий"


class Auditoriums(models.Model):
    number = models.IntegerField(verbose_name="Номер", primary_key=True, editable=False, help_text="Номер аудитории")
    description = models.TextField(verbose_name="Описание", default='', editable=True, null=True, blank=True, help_text="Описание аудитории (например, особое название, в честь кого она была названа)")
    floor = models.SmallIntegerField(verbose_name="Этаж", editable=False, validators=[MinValueValidator(1),MaxValueValidator(7),], help_text="Номер этажа")
    auditorium_type = models.ForeignKey(Auditorium_Types, verbose_name="Тип", editable=True, on_delete=models.SET_NULL, null=True, blank=True)
    have_lessons = models.BooleanField(verbose_name="Пары?", default=False, editable=False, help_text="Проводятся ли пары в аудитории") # это поле недоступно для ввода (меняют только триггеры)

    def __str__(self):
        return f"{self.number}, этаж {self.floor}, {self.auditorium_type if self.auditorium_type else ''}, пары {'' if self.have_lessons else 'не'} проводятся"
    
    class Meta:
        verbose_name = "Аудитория"
        verbose_name_plural = "Аудитории"


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

    lesson = models.ForeignKey(Lessons, verbose_name="Пара", on_delete=models.RESTRICT)
    auditorium = models.ForeignKey(Auditoriums, verbose_name="Аудитория", on_delete=models.SET_NULL, null=True)
    subgroup = models.SmallIntegerField(verbose_name="Подгруппа", null=True, choices=SUBGROUP_VARIANTS, default=None, blank=True, help_text="Подгруппа")
    week_day = models.SmallIntegerField(verbose_name="День недели", choices=DAYS_ON_WEEK, default="1", help_text="Номер дня недели")
    time = models.SmallIntegerField(verbose_name="Время", choices=LESSON_TIME, help_text="Номер пары")
    parity = models.BooleanField(verbose_name="Чётность", choices=LESSON_PARITY, null=True, default=None, blank=True, help_text="Числитель или знаменатель")
    comment = models.TextField(verbose_name="Комментарий", max_length=255, null=True, default=None, blank=True, help_text="Комментарий от диспетчера")
    def __str__(self):
        return f"[id: {self.pk}] {self.week_day} {self.time} {self.lesson}, комната {self.auditorium}, для {f'{self.subgroup} подгруппы' if self.subgroup else 'всей группы'}, {self.type}, {self.parity if self.parity else ''}"
    
    class Meta:
        verbose_name = "Пункт расписания"
        verbose_name_plural = "Пункты расписания"

