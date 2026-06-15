from django import template
from django.contrib.admin.templatetags.admin_list import result_headers
from django.utils.html import strip_tags

register = template.Library()

@register.inclusion_tag('admin/change_list_results.html', takes_context=True)
def custom_result_list(context, cl):
    """
    Passes raw model objects to the template
    """
    headers = list(result_headers(cl))
    results = list(cl.result_list)
    result_hidden_fields = list(cl.result_hidden_fields) if hasattr(cl, 'result_hidden_fields') else []
    field_info = context.get('field_info', {})

    calculated_fields = {}
    for field_name, info in field_info.items():
        if info.get('type') == 'raw_html' or field_name == 'display_have_lessons':
            admin_method = getattr(cl.model_admin, field_name, None)
            if callable(admin_method):
                calculated_fields[field_name] = {
                    obj.pk: admin_method(obj) for obj in results
                }

    context.update({
        'cl': cl,
        'result_headers': headers,
        'results': results,
        'result_hidden_fields': result_hidden_fields,
        'field_info': field_info,
        'model_meta': context.get('model_meta', {}),
        'calculated_fields': calculated_fields,
    })
    
    return context.flatten()


@register.filter
def parse_deleted_objects(nested_list):
    """
    Transform deleted_objects list from Django to list of typles (verbose_name_модели, object __str__).
    """
    result = []
    
    def _flatten(item):
        if isinstance(item, list):
            for sub_item in item:
                _flatten(sub_item)
        else:
            
            parts = str(strip_tags(str(item))).split(': ', 1)
            if len(parts) == 2:
                result.append((parts[0], parts[1]))
            else:
                result.append(('Объект', parts[0]))
                
    _flatten(nested_list)
    return result