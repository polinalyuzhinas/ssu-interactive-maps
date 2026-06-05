from django import template

register = template.Library()

@register.filter
def get(dictionary, key):
    """Безопасное получение значения из словаря в шаблоне."""
    if isinstance(dictionary, dict):
        result = dictionary.get(key, {})
        return result
    return {}

@register.filter
def lookup(lst, index):
    """Получение элемента списка по индексу."""
    try:
        return lst[index]
    except (IndexError, TypeError):
        return None

@register.filter
def get_attr(obj, attr_name):
    if hasattr(obj, 'instance'):
        obj = obj.instance
    return getattr(obj, attr_name, None)

@register.filter
def type(obj):
    return str(type(obj))

@register.filter
def has_attr(obj, attr_name):
    return hasattr(obj, attr_name)