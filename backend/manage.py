import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'iot_project.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Không thể import Django. Hãy chắc rằng bạn đã cài đặt Django "
            "và môi trường ảo (virtualenv) đang được kích hoạt."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
