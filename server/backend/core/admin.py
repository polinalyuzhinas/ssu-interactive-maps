import json
import re
from django.db import models
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Auditoriums, Auditorium_Types, Lessons, Faculty_Teachers, Faculties, Lessons_Schedule, Groups_Schedule, Groups
from django.contrib.admin.sites import site
from django.http import JsonResponse
from django.contrib.admin.views.decorators import staff_member_required
from django.apps import apps
from django.views.decorators.http import require_http_methods
from django.template.response import TemplateResponse
from django.db.models import Q
from django.utils.html import format_html
from django.db.models.functions import Lower
from django.core.exceptions import FieldDoesNotExist

@staff_member_required
@require_http_methods(["POST"])
def update_cell(request, app_label, model_name):  
    try:
        data = json.loads(request.body)
        pk = data.get('pk')
        field = data.get('field')
        value = data.get('value')
        
        model = apps.get_model(app_label, model_name)
        obj = model.objects.get(pk=pk)
        
        model_field = model._meta.get_field(field)
        
        # ForeignKey
        if model_field.is_relation and model_field.many_to_one:
            if value and value != '':
                try:
                    related_pk = int(value)
                except (ValueError, TypeError):
                    related_pk = value
                
                related_model = model_field.related_model
                value = related_model.objects.get(pk=related_pk)
            else:
                value = None
                
        # BooleanField
        elif model_field.get_internal_type() == 'BooleanField':
            value = value == 'True'
            
        # with choices
        elif hasattr(model_field, 'choices') and model_field.choices:
            # trying to convert to int
            first_choice = model_field.choices[0][0]
            if isinstance(first_choice, int):
                try:
                    value = int(value)
                except (ValueError, TypeError):
                    pass
            
        setattr(obj, field, value)
        
        obj.save()
        
        obj.refresh_from_db()
        
        return JsonResponse({'success': True, 'message': 'Saved'})
        
    except Exception as e:
        print(f"\nerror: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
@staff_member_required
def get_field_info(request, app_label, model_name, field_name):
    try:
        model = apps.get_model(app_label, model_name)
        field = model._meta.get_field(field_name)
        
        if field.is_relation and field.many_to_one:
            related_model = field.related_model
            choices = []
            for obj in related_model.objects.all()[:100]:
                choices.append({
                    'value': str(obj.pk),
                    'label': str(obj)
                })
            return JsonResponse({'type': 'foreignkey', 'choices': choices})
        
        elif hasattr(field, 'choices') and field.choices:
            choices = []
            for value, label in field.choices:
                choices.append({
                    'value': str(value),
                    'label': str(label)
                })
            return JsonResponse({'type': 'choices', 'choices': choices})
        
        elif field.get_internal_type() == 'BooleanField':
            choices = [
                {'value': 'True', 'label': 'Да'},
                {'value': 'False', 'label': 'Нет'},
            ]
            return JsonResponse({'type': 'boolean', 'choices': choices})
        
        else:
            return JsonResponse({'type': 'text', 'choices': []})
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@staff_member_required
def autocomplete_view(request):
    try:
        term = request.GET.get('term', '').strip()
        app_label = request.GET.get('app_label')
        model_name = request.GET.get('model_name')
        field_name = request.GET.get('field_name')
        
        if not all([app_label, model_name, field_name]):
            return JsonResponse({'results': []})
        
        model = apps.get_model(app_label, model_name)
        model_field = model._meta.get_field(field_name)
        
        if model_field.is_relation and model_field.many_to_one:
            related_model = model_field.related_model
            
            # assembling all text from related fields
            search_fields = [
                f.name for f in related_model._meta.fields 
                if isinstance(f, (models.CharField, models.TextField, models.IntegerField, models.SmallIntegerField))
            ]
            for f in related_model._meta.fields:
                if f.is_relation and f.many_to_one:
                    deeper_model = f.related_model
                    for deeper_f in deeper_model._meta.fields:
                        if isinstance(deeper_f, (models.CharField, models.TextField)):
                            search_fields.append(f"{f.name}__{deeper_f.name}")
            
            qs = related_model.objects.all()
            
            if term:
                # deleting all symbols except alphas, digits and whitespaces
                clean_term = re.sub(r'[^a-zA-Zа-яА-ЯёЁ0-9\s]', '', term)
                words = clean_term.split()
                
                q_objects = Q()
                for word in words:
                    if len(word) < 2:
                        continue 
                    
                    word_q = Q()
                    for sf in search_fields:
                        word_q |= Q(**{f'{sf}__icontains': word.lower()})
                    q_objects &= word_q 
                
                qs = qs.filter(q_objects)
            
            results = [{'id': str(obj.pk), 'text': str(obj)} for obj in qs[:20]]
            return JsonResponse({'results': results})
            
        else:
            queryset = model.objects.exclude(**{f'{field_name}__isnull': True})
            
            if isinstance(model_field, (models.CharField, models.TextField)):
                queryset = queryset.exclude(**{f'{field_name}__exact': ''})

            if term:
                queryset = queryset.annotate(
                    **{f'{field_name}_lower': Lower(field_name)}
                ).filter(**{f'{field_name}_lower__contains': term.lower()})
            
            values = queryset.values_list(field_name, flat=True).distinct()[:20]
            results = [{'id': str(val), 'text': str(val)} for val in values if val]
            return JsonResponse({'results': results})
            
    except Exception as e:
        print(f"Autocomplete error: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e), 'results': []}, status=400)

def get_field_choices(field):
    choices = []
    
    if hasattr(field, 'choices') and field.choices:
        for value, label in field.choices:
            safe_value = '' if value is None else value 
            choices.append({
                'value': safe_value,
                'label': str(label)
            })
        return choices

    if field.is_relation and field.many_to_one:
        related_model = field.related_model
        qs = related_model.objects.all()
        for obj in qs:
            choices.append({
                'value': obj.pk,
                'label': str(obj)
            })
        return choices

    return choices

def get_field_type(field):
    if isinstance(field, models.BooleanField):
        return 'boolean'
    if field.is_relation and field.many_to_one:
        return 'foreignkey'
    if hasattr(field, 'choices') and field.choices:
        return 'choices'
    if isinstance(field, (models.TextField, models.CharField)):
        return 'text'
    return 'default'

@staff_member_required
def get_all_objects(request, app_label=None, model_name=None, *args, **kwargs):
    # if arguments from kwargs paramenter
    if app_label is None:
        app_label = kwargs.get('app_label')
    if model_name is None:
        model_name = kwargs.get('model_name')
    
    try:
        model = apps.get_model(app_label, model_name)
        admin_class = admin.site._registry.get(model)
        if not admin_class:
            return JsonResponse({'error': 'Admin not registered'}, status=400)
        
        list_display = [f for f in admin_class.list_display if f != 'action_checkbox']
        
        field_info = {}
        for field_name in list_display:
            try:
                field = model._meta.get_field(field_name)
                field_info[field_name] = {
                    'type': get_field_type(field),
                    'name': field_name,
                    'choices': get_field_choices(field),
                    'verbose_name': field.verbose_name or field_name,
                    'editable': field.editable,
                }
            except Exception:
                admin_method = getattr(admin_class, field_name, None)

                field_info[field_name] = {
                    'type': 'raw_html',
                    'name': field_name,
                    'choices': [],
                    'verbose_name': getattr(admin_method, 'short_description', field_name.replace('_', ' ').title()) if admin_method else field_name.replace('_', ' ').title(),
                    'editable': False,
                }

        objects_data = []
        for obj in model.objects.all():
            obj_data = {'pk': obj.pk}
            for field_name in list_display:
                try:
                    try:
                        model_field = model._meta.get_field(field_name)

                        value = getattr(obj, field_name)
                    except FieldDoesNotExist:
                        admin_method = getattr(admin_class, field_name, None)
                        if callable(admin_method):
                            value = admin_method(obj)
                        else:
                            value = getattr(obj, field_name, '')
                    
                    if value and hasattr(value, 'pk'):
                        obj_data[field_name] = {
                            'pk': value.pk,
                            'text': str(value)
                        }
                    elif isinstance(value, bool):
                        obj_data[field_name] = value
                    else:
                        obj_data[field_name] = str(value) if value is not None else ''
                except Exception as e:
                    print(f"Error getting {field_name} for {obj.pk}: {e}")
                    obj_data[field_name] = ''
            
            objects_data.append(obj_data)
        
        return JsonResponse({
            'success': True,
            'data': objects_data,
            'list_display': list_display,
            'field_info': field_info,
            'total': len(objects_data)
        })
        
    except Exception as e:
        print(f"get_all_objects error: {e}")
        return JsonResponse({'error': str(e), 'success': False}, status=500)
    
class BaseModelAdminMixin:
    list_per_page = 50

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['app_list'] = site.get_app_list(request)
        extra_context['model_help_text'] = getattr(self.model, 'model_help_text', '')
        response = super().changelist_view(request, extra_context)

        if isinstance(response, TemplateResponse):
            model = self.model
            field_info = {}
            for field_name in self.list_display:
                try:
                    field = model._meta.get_field(field_name)
                    field_info[field_name] = {
                        'type': get_field_type(field),
                        'name': field_name,
                        'choices': get_field_choices(field),
                        'verbose_name': field.verbose_name or field_name,
                        'editable': field.editable,
                        'help_text': field.help_text or '',
                    }
                except Exception:
                    admin_method = getattr(self, field_name, None)
                    
                    default_name = field_name.replace('_', ' ').title()
                    if admin_method:
                        method_name = getattr(admin_method, 'description', getattr(admin_method, 'short_description', default_name))
                    else:
                        method_name = default_name

                    field_info[field_name] = {
                        'type': 'raw_html',
                        'name': field_name,
                        'choices': [],
                        'verbose_name': method_name,
                        'editable': False,
                    }

            response.context_data['field_info'] = field_info
            response.context_data['model_meta'] = {
                'app_label': model._meta.app_label,
                'model_name': model._meta.model_name,
            }
        
        return response

admin.site.site_header = _("Отредактировать расписание")
admin.site.index_title = ""

@admin.register(Auditoriums)
class AuditoriumsAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('number', 'description', 'floor', 'auditorium_type', 'display_have_lessons')

    @admin.display(description='Есть ли пары?')
    def display_have_lessons(self, obj):
        is_checked = 'checked' if obj.have_lessons else ''
        return format_html(
            '<input type="checkbox" {} disabled style="width: 18px; height: 18px; cursor: not-allowed; accent-color: var(--notification-success, #709E6E);">',
            is_checked
        )
    
@admin.register(Auditorium_Types)
class AuditoriumsTypesAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('name', )

@admin.register(Faculties)
class FacultiesAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('full_name', 'short_name')

@admin.register(Faculty_Teachers)
class FacultyTeachersAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('surname', 'name', 'patronymic', 'faculty')

@admin.register(Lessons) 
class LessonsAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'assignment', 'lesson_type')

@admin.register(Groups)
class GroupsAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('number', 'faculty', 'group_type', 'form')
  
@admin.register(Groups_Schedule)
class GroupsScheduleAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('group', 'lesson')

@admin.register(Lessons_Schedule)
class LessonsScheduleAdmin(BaseModelAdminMixin, admin.ModelAdmin):
    list_display = ('week_day', 'time', 'auditorium', 'lesson', 'subgroup', 'parity', 'comment')

original_get_app_list = admin.site.get_app_list

def custom_get_app_list(request, app_label=None):
    app_list = original_get_app_list(request, app_label)
    
    filtered_app_list = []
    for app in app_list:
        filtered_models = []
        for model in app['models']:
            # filtering User и Group deafault Django models from app_list
            if app['app_label'] == 'auth' and model['object_name'] in ['User', 'Group']:
                continue
            filtered_models.append(model)
        
        if filtered_models:
            app['models'] = filtered_models
            filtered_app_list.append(app)
            
    return filtered_app_list

admin.site.get_app_list = custom_get_app_list