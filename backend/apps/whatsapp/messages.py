"""Built-in Hindi message bodies, one per trigger.

These are the fallback the simulator uses before Meta has approved anything —
so the whole flow can be demoed on day one with no credentials.

Once the owner binds an approved Meta template to a trigger, the template wins
for the actual send, and `variables` below decides what fills {{1}}, {{2}} … in
the order Meta expects.
"""

from apps.whatsapp.models import TriggerType

# body      — Hindi text with {named} placeholders, used in mock mode
# variables — ordered names that map to Meta's {{1}}, {{2}}, … in a template
TRIGGER_MESSAGES = {
    TriggerType.WELCOME: {
        'label': 'Welcome',
        'body': (
            'नमस्ते {name} 🙏\n\n'
            '{restaurant} परिवार में आपका स्वागत है!\n'
            'अब हर बिल पर आपको लॉयल्टी पॉइंट्स मिलेंगे, जो अगली बार बिल में इस्तेमाल हो सकते हैं।\n\n'
            'जल्द मिलते हैं! 🍽️'
        ),
        'variables': ['name', 'restaurant'],
    },
    TriggerType.BILL_RECEIPT: {
        'label': 'Bill receipt',
        'body': (
            'नमस्ते {customer_name} 🙏\n\n'
            '{restaurant_name} में आने के लिए धन्यवाद!\n\n'
            'बिल नंबर: {bill_number}\n'
            'कुल राशि: ₹{bill_amount}\n'
            'इस बिल पर मिले पॉइंट्स: {earned_points}\n'
            'आपके कुल पॉइंट्स: {available_points}\n\n'
            'फिर आइएगा! 🙏'
        ),
        'variables': ['customer_name', 'restaurant_name', 'bill_number', 'bill_amount', 'earned_points', 'available_points'],
    },
    TriggerType.FEEDBACK: {
        'label': 'Feedback request',
        'body': (
            'नमस्ते {name} 🙏\n\n'
            'आज {restaurant} में खाना कैसा लगा? एक मिनट में बताइए —\n'
            '{link}\n\n'
            'आपकी राय से हम और बेहतर बनेंगे। 🌟'
        ),
        'variables': ['name', 'restaurant', 'link'],
    },
    TriggerType.WINBACK: {
        'label': 'Win-back',
        'body': (
            'नमस्ते {name} 🙏\n\n'
            'आपको {days} दिन से {restaurant} में नहीं देखा!\n'
            'आपकी पसंदीदा डिश आपका इंतज़ार कर रही है।\n\n'
            'आपके {balance} पॉइंट्स भी जमा हैं — अगली बार बिल में इस्तेमाल कीजिए। 🍽️'
        ),
        'variables': ['name', 'days', 'restaurant', 'balance'],
    },
    TriggerType.BIRTHDAY: {
        'label': 'Birthday offer',
        'body': (
            'जन्मदिन मुबारक हो {name}! 🎂\n\n'
            '{restaurant} की तरफ से ढेर सारी शुभकामनाएं।\n'
            'आज हमारे यहाँ आइए और अपना खास दिन और खास बनाइए! 🎁'
        ),
        'variables': ['name', 'restaurant'],
    },
    TriggerType.ANNIVERSARY: {
        'label': 'Anniversary offer',
        'body': (
            'शादी की सालगिरह मुबारक हो {name}! 💍\n\n'
            '{restaurant} में इस खास दिन को और यादगार बनाइए।\n'
            'आपका इंतज़ार रहेगा! 🎁'
        ),
        'variables': ['name', 'restaurant'],
    },
    TriggerType.BROADCAST: {
        'label': 'Broadcast',
        'body': 'नमस्ते {name} 🙏\n\n{message}',
        'variables': ['name', 'message'],
    },
}


def render_default(trigger, context):
    """Fill the built-in Hindi body. Missing keys render as blank, never crash —
    a half-filled message in the simulator beats a 500 during service."""
    spec = TRIGGER_MESSAGES.get(trigger)
    if not spec:
        return ''
    safe = {key: context.get(key, '') for key in _placeholders(spec['body'])}
    return spec['body'].format(**safe)


def render_template(template, context, trigger):
    """Substitute {{1}}, {{2}} … in a Meta template body for on-screen preview.

    The real send passes these same values to Meta as ordered parameters; this
    only exists so the simulator shows what the customer will actually read.
    """
    body = template.body_text or ''
    for index, value in enumerate(template_variables(trigger, context), start=1):
        body = body.replace('{{%d}}' % index, str(value))
    return body


def template_variables(trigger, context):
    """Ordered values for a Meta template's body parameters."""
    spec = TRIGGER_MESSAGES.get(trigger, {})
    return [str(context.get(name, '')) for name in spec.get('variables', [])]


def _placeholders(text):
    import string

    return {name for _, name, _, _ in string.Formatter().parse(text) if name}
