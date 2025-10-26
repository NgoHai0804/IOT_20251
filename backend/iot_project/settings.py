DATABASES = {
    'default': {
        'ENGINE': 'djongo',
        'NAME': 'iot_db', 
        'CLIENT': {
            'host': 'mongodb://localhost:27017',
        }
    }
}

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework',
    'rest_framework.authtoken',
    'iot_app',
]


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
}


