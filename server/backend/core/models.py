# Django ORM для определения моделей и связей между ними
from django.db import models
# Валидаторы для ограничения числовых значений (этажи от 1 до 7)
from django.core.validators import MinValueValidator, MaxValueValidator
# Исключение для сигнализации об ошибках валидации в админке
from django.core.exceptions import ValidationError
# Q-объекты для построения сложных SQL-запросов с логическими операторами OR
from django.db.models import Q

# =============================================================================
# модель Faculties (Факультеты)
# Базовый справочник факультетов, которые проводят занятия в корпусе.
# Используется как внешний ключ в моделях Faculty_Teachers и Groups.
# =============================================================================
class Faculties(models.Model):
    full_name = models.TextField(verbose_name="Название", max_length=255, editable=False, default=None, unique=True, help_text="Полное название")
    short_name = models.TextField(verbose_name="Аббревиатура", max_length=15, editable=False, null=True, blank=True, help_text="Аббревиатура (если полное название длинное)")

    model_help_text = "Содержит список факультетов, которые проводят занятия в XVII корпусе."

    def __str__(self):
        return self.short_name if self.short_name else self.full_name
    
    class Meta:
        verbose_name = "Факультет"
        verbose_name_plural = "Факультеты"


# =============================================================================
# модель: Faculty_Teachers (Преподаватели)
# Связь "преподаватель + факультет". Один и тот же человек может быть
# представлен несколькими записями, если он ведёт пары на разных факультетах.
# Запрещены полные дубликаты полей.
# =============================================================================
class Faculty_Teachers(models.Model):
    faculty = models.ForeignKey(Faculties, verbose_name="Факультет", editable=True, on_delete=models.RESTRICT, null=True, blank=True, help_text="Выберите из существующих")
    surname = models.TextField(verbose_name="Фамилия", max_length=255, editable=True, help_text="Фамилия преподавателя")
    name = models.TextField(verbose_name="Имя", max_length=255, editable=True, help_text="Имя преподавателя")
    patronymic = models.TextField(verbose_name="Отчество", null=True, max_length=255, editable=True, blank=True, help_text="Отчество преподавателя (если есть)")

    def __str__(self):
       return f"{self.surname} {self.name[0]} {self.patronymic[0] if self.patronymic else ''} ({self.faculty})"

    model_help_text = "Содержит список записей Преподаватель-Факультет. Один и тот же преподаватель может преподавать на разных факультетах."

    class Meta:
        verbose_name = "Преподаватель"
        verbose_name_plural = "Преподаватели"
        constraints = [
            models.UniqueConstraint(
                fields=['surname', 'name', 'patronymic', 'faculty'],
                name='unique_teacher_per_faculty'
            )
        ]


# =============================================================================
# модель: Lessons (Пары)
# Справочник учебных дисциплин. Каждая пара привязана к преподавателю
# (через Faculty_Teachers) и имеет тип (лекция/практика/лабораторная).
# Запрещены полные дубликаты полей.
# =============================================================================
class Lessons(models.Model):
    LESSON_TYPES = [
        (1, "Практика"),
        (2, "Лекция"),
        (3, "Лабораторная"),
    ]

    model_help_text = "Содержит список пар. Пары могут разного типа."

    name = models.TextField(verbose_name="Название", editable=True, max_length = 400, help_text="Название пары")
    assignment = models.ForeignKey(Faculty_Teachers, verbose_name="Назначен", editable=True, null=True, blank=True, on_delete=models.RESTRICT, help_text="Прикрепляется запись преподаватель-факультет для этой пары")
    lesson_type = models.SmallIntegerField(verbose_name="Тип", editable=True, choices=LESSON_TYPES, null=True, default=None, blank=True, help_text="Практика, лекция или лабораторная")

    def __str__(self):
        assignment_str = str(self.assignment) if self.assignment else 'не назначен'
        return f"{self.name}, {assignment_str}, {self.get_lesson_type_display()}"
    
    class Meta:
        ordering = ('name',)
        verbose_name = "Пара"
        verbose_name_plural = "Пары"


# =============================================================================
# модель: Groups (Учебные группы)
# Справочник студенческих групп с привязкой к факультету, виду обучения
# (бакалавриат/специалитет/магистратура/аспирантура, потом будут "базовое
# высшее" и "специализированное высшее") и форме (очная/заочная/очно-заочная/
# /вечернее).
# Запрещены полные дубликаты полей.
# =============================================================================
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

    model_help_text = "Содержит список учебных групп, которые обучаются в XVII корпусе."

    number = models.IntegerField(verbose_name="Номер", editable=True, help_text="Обычно трёхзначное число")
    faculty = models.ForeignKey(Faculties, verbose_name="Факультет", editable=True, on_delete=models.RESTRICT, help_text="Выберите из существующих")
    group_type = models.SmallIntegerField(verbose_name="Вид", editable=True, choices=GROUPS_TYPES, default=0, blank=True, help_text="Бакалавриат, специалитет, магистратура или аспирантура")
    form = models.SmallIntegerField(verbose_name="Форма", editable=True, choices=EDU_FORMS, default=0, blank=True, help_text="Очное, заочное, очно-заочное или вечернее")

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


# =============================================================================
# модель: Groups_Schedule (Пары по группам)
# Промежуточная модель Many-to-Many между Groups и Lessons.
# Нужна для поддержки лекционных потоков: одна и та же пара (Lessons)
# может быть назначена нескольким группам одновременно.
# Запрещены полные дубликаты полей.
# =============================================================================
class Groups_Schedule(models.Model):
    group = models.ForeignKey(Groups, editable=True, verbose_name="Группа", on_delete=models.CASCADE, help_text="Выберите из существующих записей")
    lesson = models.ForeignKey(Lessons, editable=True, verbose_name="Пара", on_delete=models.CASCADE, help_text="Выберите из существующих записей")

    model_help_text = "Содержит список записей в формате Группа-Пара."

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
    
# =============================================================================
# модель: Auditorium_Types (Виды аудиторий)
# Справочник типов помещений: лекционная, компьютерный класс и т.д.
# =============================================================================
class Auditorium_Types(models.Model):
    name = models.TextField(verbose_name="Тип", unique=True, editable=False, max_length = 255, help_text="Название типа")

    model_help_text = "Содержит список видов аудиторий (лекционная аудитория, компьютерный класс и т. п.)"

    def __str__(self):
        return f"{self.name}"
    
    class Meta:
        verbose_name = "Вид аудиторий"
        verbose_name_plural = "Виды аудиторий"


# =============================================================================
# модель: Auditoriums (Аудитории)
# Помещения корпуса. Номер аудитории является первичным ключом.
# Поле have_lessons вычисляется автоматически при сохранении 
# записей расписания (Lessons_Schedule).
# =============================================================================
class Auditoriums(models.Model):
    number = models.IntegerField(verbose_name="Номер", primary_key=True, editable=False, help_text="Номер аудитории")
    description = models.TextField(verbose_name="Описание", max_length=400, default='', editable=True, null=True, blank=True, help_text="Описание аудитории (например, особое название, в честь кого она была названа)")
    floor = models.SmallIntegerField(verbose_name="Этаж", editable=False, validators=[MinValueValidator(1),MaxValueValidator(7),], help_text="Номер этажа")
    auditorium_type = models.ForeignKey(Auditorium_Types, verbose_name="Тип", editable=True, on_delete=models.SET_NULL, null=True, blank=True, help_text="Лекционная аудитория, компьютерный класс и т.п.")
    have_lessons = models.BooleanField(verbose_name="Пары?", default=False, editable=False, help_text="Проводятся ли пары в аудитории") # это поле недоступно для ввода (меняют только триггеры)

    model_help_text = "Содержит список аудиторий XVII корпуса."

    def save(self, *args, **kwargs):
        """
        Переопределение сохранения: после записи в БД обновляется
        поле have_lessons на основе наличия пар в расписании.
        """
        super().save(*args, **kwargs)
        self._update_auditorium_status()

    def delete(self, *args, **kwargs):
        """
        Переопределение удаления. Сохраняем ссылку на объект до удаления,
        чтобы после удаления из БД можно было корректно завершить обновление
        статуса аудитории (наличие пар в ней).
        """
        auditorium = self
        super().delete(*args, **kwargs)
        if auditorium:
            self._update_auditorium_status(auditorium)

    def _update_auditorium_status(self, auditorium=None):
        """
        Метод синхронизации флага have_lessons.
        Проверяет, есть ли в Lessons_Schedule записи с этой аудиторией,
        и при необходимости обновляет поле через update_fields
        (чтобы не вызывать рекурсивный save).
        """
        aud = auditorium or self
        if aud:
            has_lessons = Lessons_Schedule.objects.filter(auditorium=aud).exists()
            if aud.have_lessons != has_lessons:
                aud.have_lessons = has_lessons
                aud.save(update_fields=['have_lessons'])

    def __str__(self):
        return f"{self.number} {self.description} этаж {self.floor}, {self.auditorium_type if self.auditorium_type else ''}, пары {'' if self.have_lessons else 'не'} проводятся"
    
    class Meta:
        ordering = ('number',)
        verbose_name = "Аудитория"
        verbose_name_plural = "Аудитории"


# =============================================================================
# модель: Lessons_Schedule (Пункты расписания)
# Центральная модель системы. Хранит конкретные слоты расписания:
# какая пара, в какой аудитории, в какой день, время и для какой подгруппы.
# =============================================================================
class Lessons_Schedule(models.Model):
    SUBGROUP_VARIANTS = [
        (0, "Вся группа"), 
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
        (0, "нет"),
        (1, "Числитель"),
        (2, "Знаменатель"),
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

    model_help_text = "Содержит список пунктов расписания (время, день недели, подгруппа, чётность, запись группа-пара)."

    lesson = models.ForeignKey(Groups_Schedule, verbose_name="Пара", on_delete=models.RESTRICT, help_text="Запись Пара-Группа")
    auditorium = models.ForeignKey(Auditoriums, verbose_name="Аудитория", on_delete=models.SET_NULL, null=True, help_text="Аудитория, в которой пара проводится")
    subgroup = models.SmallIntegerField(verbose_name="Подгруппа", null=True, default=None, blank=True, choices=SUBGROUP_VARIANTS, help_text="Подгруппа", db_index=True)
    week_day = models.SmallIntegerField(verbose_name="День недели", choices=DAYS_ON_WEEK, help_text="День недели", db_index=True)
    time = models.SmallIntegerField(verbose_name="Время", choices=LESSON_TIME, help_text="Время проведения пары", db_index=True)
    parity = models.SmallIntegerField(verbose_name="Чётность", null=True, default=None, blank=True, choices=LESSON_PARITY, help_text="Числитель или знаменатель", db_index=True)
    comment = models.TextField(verbose_name="Комментарий", max_length=400, null=True, blank=True, help_text="Комментарий от диспетчера", db_index=True)
    
    def __str__(self):
        return f"{self.get_week_day_display()} {self.get_time_display()} {self.lesson}, комната {self.auditorium}, для {f'{self.subgroup} подгруппы' if self.subgroup else 'всей группы'}, {self.get_parity_display()}"
    
    class Meta:
        verbose_name = "Пункт расписания"
        verbose_name_plural = "Пункты расписания"

        # Составные индексы для ускорения часто выполняемых запросов:
        # - все пары в конкретный день и время
        # - расписание конкретной аудитории
        # - расписание конкретной пары (для поиска конфликтов преподавателя)
        indexes = [
            models.Index(fields=['week_day', 'time']),
            models.Index(fields=['auditorium', 'week_day', 'time']),
            models.Index(fields=['lesson', 'week_day', 'time']),
        ]

    def clean(self):
        """
        Проверяет отсутствие конфликтов по четырём направлениям:
          1. Конфликт по аудитории (два разных занятия в одной комнате одновременно)
          2. Конфликт по преподавателю (один преподаватель не может вести две пары одновременно)
          3. Конфликт по группе/подгруппе (студенты не могут быть в двух местах одновременно)
          4. Проверка типа для лекционных потоков (одна и та же пара должна иметь один тип)
        
        Проверка на лекционный поток учитывает чётность (числитель/знаменатель):
          - "нет" (каждую неделю) конфликтует со всеми записями
          - "числитель" конфликтует с "числителем" и "нет"
          - "знаменатель" конфликтует со "знаменателем" и "нет"
        """
        super().clean()

        if not self.week_day or not self.time or not self.auditorium or not self.lesson:
            return

        # все записи в тот же день и время, исключая себя
        base_qs = Lessons_Schedule.objects.filter(
            week_day=self.week_day,
            time=self.time
        ).exclude(pk=self.pk)

        # правила чётности: какие записи могут конфликтовать по времени/месту/преподавателю
        if self.parity is None or self.parity == 0: # нет чётности (каждую неделю) или чётность не выставлена
            parity_q = Q()
        elif self.parity == 1: # числитель
            parity_q = Q(parity=1) | Q(parity=0)
        elif self.parity == 2: # знаменатель
            parity_q = Q(parity=2) | Q(parity=0)
        else:
            parity_q = Q(parity__isnull=True)

        if self.auditorium:
            room_conflict_qs = base_qs.filter(auditorium=self.auditorium).filter(parity_q)
            same_lesson_qs = room_conflict_qs.filter(lesson__lesson=self.lesson.lesson)
            other_lesson_qs = room_conflict_qs.exclude(lesson__lesson=self.lesson.lesson)

            if other_lesson_qs.exists():
                raise ValidationError({
                    'auditorium': 'Аудитория уже занята другой парой в это время.'
                })

            if same_lesson_qs.exists():
                conflicting_types = same_lesson_qs.values_list('lesson__lesson__lesson_type', flat=True).distinct()
                current_type = self.lesson.lesson.lesson_type
                if any(t != current_type for t in conflicting_types):
                    lesson_type_names = dict(Lessons.LESSON_TYPES)
                    curr_name = lesson_type_names.get(current_type, 'неизвестный')
                    raise ValidationError({
                        'auditorium': (
                            f'В этой аудитории уже проходит та же пара, но с другим типом ({curr_name} vs другое). '
                            f'Тип должен совпадать для лекционного потока.'
                        )
                    })
                # если типы совпадают – конфликта по аудитории нет

        if self.lesson and self.lesson.lesson and self.lesson.lesson.assignment:
            teacher_qs = base_qs.filter(
                lesson__lesson__assignment=self.lesson.lesson.assignment
            ).filter(parity_q)

            same_lesson_teacher_qs = teacher_qs.filter(lesson__lesson=self.lesson.lesson)
            other_lesson_teacher_qs = teacher_qs.exclude(lesson__lesson=self.lesson.lesson)

            if other_lesson_teacher_qs.exists():
                raise ValidationError({
                    'lesson': 'Преподаватель уже ведёт другую пару в это время.'
                })

            if same_lesson_teacher_qs.exists():
                conflicting_types = same_lesson_teacher_qs.values_list('lesson__lesson__lesson_type', flat=True).distinct()
                current_type = self.lesson.lesson.lesson_type
                if any(t != current_type for t in conflicting_types):
                    lesson_type_names = dict(Lessons.LESSON_TYPES)
                    curr_name = lesson_type_names.get(current_type, 'неизвестный')
                    raise ValidationError({
                        'lesson': (
                            f'Преподаватель уже ведёт ту же пару, но с другим типом ({curr_name}). '
                            f'Тип должен совпадать.'
                        )
                    })

        group_conflict = base_qs.filter(lesson=self.lesson).filter(parity_q)
        if self.subgroup:
            group_conflict = group_conflict.filter(
                Q(subgroup=self.subgroup) | Q(subgroup=0)
            )
        if group_conflict.exists():
            raise ValidationError({
                'lesson': 'Группа (или подгруппа) уже занята в это время другой парой.'
            })