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
    faculty = models.ForeignKey(Faculties, verbose_name="Факультет", editable=True, on_delete=models.RESTRICT, null=True, blank=True, help_text="Выберите из существующих")
    surname = models.TextField(verbose_name="Фамилия", max_length=255, editable=True, help_text="Фамилия преподавателя")
    name = models.TextField(verbose_name="Имя",max_length=255, editable=True, help_text="Имя преподавателя")
    patronymic = models.TextField(verbose_name="Отчество", null=True, max_length=255, editable=True, blank=True, help_text="Отчество преподавателя (если есть)")

    def __str__(self):
       return f"{self.surname} {self.name} {self.patronymic if self.patronymic else ''} ({self.faculty})"

    class Meta:
        verbose_name = "Преподаватель"
        verbose_name_plural = "Преподаватели"
        constraints = [
            models.UniqueConstraint(
                fields=['surname', 'name', 'patronymic', 'faculty'],
                name='unique_teacher_per_faculty'
            )
        ]

class Lessons(models.Model):
    LESSON_TYPES = [
        (1, "Практика"),
        (2, "Лекция"),
        (3, "Лабораторная"),
    ]

    name = models.TextField(verbose_name="Название", editable=True, max_length = 400, help_text="Название пары")
    assignment = models.ForeignKey(Faculty_Teachers, verbose_name="Назначен", editable=True, null=True, blank=True, on_delete=models.RESTRICT, help_text="Прикрепляется запись преподаватель-факультет для этой пары")
    lesson_type = models.SmallIntegerField(verbose_name="Тип", editable=True, choices=LESSON_TYPES, default=1, help_text="Практика, лекция или лабораторная")

    def __str__(self):
        assignment_str = str(self.assignment) if self.assignment else 'не назначен'
        return f"{self.name}, {assignment_str}, {self.get_lesson_type_display()}"
    
    class Meta:
        ordering = ('name',)
        verbose_name = "Пара"
        verbose_name_plural = "Пары"


class Groups(models.Model):
    GROUPS_TYPES = [
        (1, "Бакалавриат"),
        (2, "Специалитет"),
        (3, "Магистратура"),
        (4, "Аспирантура"),
    ]

    EDU_FORMS = [
        (1, "Очное"),
        (2, "Заочное"),
        (3, "Очно-заочное"),
        (4, "Вечернее")
    ]

    number = models.IntegerField(verbose_name="Номер", editable=True, help_text="Обычно трёхзначное число")
    faculty = models.ForeignKey(Faculties, verbose_name="Факультет", editable=True, on_delete=models.RESTRICT, help_text="Выберите их существующих")
    group_type = models.SmallIntegerField(verbose_name="Вид", editable=True, choices=GROUPS_TYPES, default=1, blank=True, help_text="Бакалавриат, специалитет, магистратура или аспирантура")
    form = models.SmallIntegerField(verbose_name="Форма", editable=True, choices=EDU_FORMS, default=1, blank=True, help_text="Очное, заочное, очно-заочное или вечернее")

    def __str__(self):
            return f"Группа {self.number} {self.faculty} {self.get_group_type_display()} {self.get_form_display()}"
    
    class Meta:
        ordering = ('number',)
        verbose_name = "Группа"
        verbose_name_plural = "Группы"
        constraints = [
            models.UniqueConstraint(
                fields=['number', 'group_type', 'form', 'faculty'],
                name='unique_group_per_faculty'
            )
        ]

class Groups_Schedule(models.Model):
    group = models.ForeignKey(Groups, editable=True, verbose_name="Группа", on_delete=models.CASCADE, help_text="Обычно трёхзначное число")
    lesson = models.ForeignKey(Lessons, editable=True, verbose_name="Пара", on_delete=models.CASCADE, help_text="Обычно трёхзначное число")

    def __str__(self):
        return f"{self.group} {self.lesson}"
    
    class Meta:
        verbose_name = "Пара по группам"
        verbose_name_plural = "Пары по группам"
        constraints = [
            models.UniqueConstraint(
                fields=['group', 'lesson'],
                name='unique_lesson_per_group'
            )
        ]
    

class Auditorium_Types(models.Model):
    name = models.TextField(verbose_name="Тип", editable=False, max_length = 255, help_text="Название типа")

    def __str__(self):
        return f"{self.name}"
    
    class Meta:
        verbose_name = "Вид аудиторий"
        verbose_name_plural = "Виды аудиторий"


class Auditoriums(models.Model):
    number = models.IntegerField(verbose_name="Номер", primary_key=True, editable=False, help_text="Номер аудитории")
    description = models.TextField(verbose_name="Описание", default='', editable=True, null=True, blank=True, help_text="Описание аудитории (например, особое название, в честь кого она была названа)")
    floor = models.SmallIntegerField(verbose_name="Этаж", editable=False, validators=[MinValueValidator(1),MaxValueValidator(7),], help_text="Номер этажа")
    auditorium_type = models.ForeignKey(Auditorium_Types, verbose_name="Тип", editable=True, on_delete=models.SET_NULL, null=True, blank=True, help_text="Лекционная аудитория, компьютерных класс и т.п.")
    have_lessons = models.BooleanField(verbose_name="Пары?", default=False, editable=False, help_text="Проводятся ли пары в аудитории") # это поле недоступно для ввода (меняют только триггеры)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self._update_auditorium_status()

    def delete(self, *args, **kwargs):
        auditorium = self.auditorium
        super().delete(*args, **kwargs)
        if auditorium:
            self._update_auditorium_status(auditorium)

    def _update_auditorium_status(self, auditorium=None):
        aud = auditorium or self.auditorium
        if aud:
            has_lessons = Lessons_Schedule.objects.filter(auditorium=aud).exists()
            if aud.have_lessons != has_lessons:
                aud.have_lessons = has_lessons
                aud.save(update_fields=['have_lessons'])

    def __str__(self):
        return f"{self.number}, этаж {self.floor}, {self.auditorium_type if self.auditorium_type else ''}, пары {'' if self.have_lessons else 'не'} проводятся"
    
    class Meta:
        ordering = ('number',)
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
        (1, "-"),
        (2, "Числитель"),
        (3, "Знаменатель"),
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

    lesson = models.ForeignKey(Groups_Schedule, verbose_name="Пара", on_delete=models.RESTRICT, help_text="Запись Пара-Группа")
    auditorium = models.ForeignKey(Auditoriums, verbose_name="Аудитория", on_delete=models.SET_NULL, null=True, help_text="Аудитория, в которой пара проводится")
    subgroup = models.SmallIntegerField(verbose_name="Подгруппа", null=True, choices=SUBGROUP_VARIANTS, default=None, blank=True, help_text="Подгруппа")
    week_day = models.SmallIntegerField(verbose_name="День недели", choices=DAYS_ON_WEEK, default="1", help_text="Номер дня недели")
    time = models.SmallIntegerField(verbose_name="Время", choices=LESSON_TIME, help_text="Номер пары")
    parity = models.SmallIntegerField(verbose_name="Чётность", choices=LESSON_PARITY, null=True, default=None, blank=True, help_text="Числитель или знаменатель")
    comment = models.TextField(verbose_name="Комментарий", max_length=255, null=True, default=None, blank=True, help_text="Комментарий от диспетчера")
    
    def __str__(self):
        return f"{self.week_day} {self.time} {self.lesson}, комната {self.auditorium}, для {f'{self.subgroup} подгруппы' if self.subgroup else 'всей группы'}, {self.time}, {self.parity}"
    
    class Meta:
        verbose_name = "Пункт расписания"
        verbose_name_plural = "Пункты расписания"

