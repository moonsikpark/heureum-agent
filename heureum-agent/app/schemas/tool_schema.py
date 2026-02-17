# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Tool schemas — OpenAI function calling format.

Each schema defines a tool the LLM can invoke. TOOL_SCHEMA_MAP maps
tool names to their schemas for lookup in AgentService.
"""

BASH_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "bash",
        "description": "Execute a bash command on the user's machine. Use this when the user asks you to run commands, check files, list directories, or perform any system operation.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The bash command to execute",
                }
            },
            "required": ["command"],
        },
    },
}

ASK_QUESTION_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "ask_question",
        "description": "Ask the user a multiple-choice question when you need clarification or when the user needs to make a decision before proceeding. Present clear choices and optionally allow free-text input.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The question to ask the user",
                },
                "choices": {
                    "type": "array",
                    "items": {
                        "oneOf": [
                            {"type": "string"},
                            {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "description": {"type": "string"},
                                },
                                "required": ["label"],
                            },
                        ]
                    },
                    "description": "List of choices the user can select from. Each choice can be a plain string or an object with label and optional description.",
                },
                "allow_user_input": {
                    "type": "boolean",
                    "description": "Whether to allow the user to type a custom answer instead of choosing from the list",
                    "default": False,
                },
            },
            "required": ["question", "choices"],
        },
    },
}

BROWSER_NAVIGATE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "browser_navigate",
        "description": "Navigate the user's current browser tab to a URL. Returns the page title, URL, interactive elements with CSS selectors, and visible text.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to navigate to (must include http:// or https://)",
                }
            },
            "required": ["url"],
        },
    },
}

BROWSER_NEW_TAB_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "browser_new_tab",
        "description": "Open a URL in a new browser tab without affecting the user's current tab. Returns page content.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to open in a new tab",
                }
            },
            "required": ["url"],
        },
    },
}

BROWSER_CLICK_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "browser_click",
        "description": "Click an element on the current browser page. Use a CSS selector from browser_get_content. Returns updated page content after the click.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector of the element to click (get selectors from browser_get_content)",
                }
            },
            "required": ["selector"],
        },
    },
}

BROWSER_TYPE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "browser_type",
        "description": "Type text into an input field on the current browser page. Use a CSS selector from browser_get_content.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector of the input element to type into",
                },
                "text": {
                    "type": "string",
                    "description": "The text to type into the input field",
                },
            },
            "required": ["selector", "text"],
        },
    },
}

BROWSER_GET_CONTENT_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "browser_get_content",
        "description": "Get the current browser page content: title, URL, interactive elements with CSS selectors, and visible text. Always call this before clicking or typing to get accurate CSS selectors.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
}

SELECT_CWD_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "select_cwd",
        "description": "Open a folder picker dialog to let the user select a working directory for subsequent bash commands. Call this before running bash commands if the user hasn't selected a working directory yet, or if they want to change it.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
}

# Mobile device tools
GET_DEVICE_INFO_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_device_info",
        "description": "Get information about the user's mobile device: model, OS, battery level, screen size, and memory.",
        "parameters": {"type": "object", "properties": {}},
    },
}

GET_SENSOR_DATA_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_sensor_data",
        "description": "Get current sensor readings from the user's mobile device: accelerometer (x,y,z), gyroscope (x,y,z), and barometer (pressure in hPa).",
        "parameters": {"type": "object", "properties": {}},
    },
}

GET_CONTACTS_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_contacts",
        "description": "Search the user's phone contacts. Returns names, phone numbers, and emails. Optionally filter by name.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Optional name to search for. Omit to get all contacts (up to 50).",
                }
            },
        },
    },
}

GET_LOCATION_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_location",
        "description": "Get the user's current GPS location: latitude, longitude, altitude, and accuracy.",
        "parameters": {"type": "object", "properties": {}},
    },
}

TAKE_PHOTO_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "take_photo",
        "description": "Open the device camera to take a photo. Returns the photo URI and dimensions. The user will see the native camera UI.",
        "parameters": {
            "type": "object",
            "properties": {
                "camera": {
                    "type": "string",
                    "enum": ["front", "back"],
                    "description": "Which camera to use. Defaults to back.",
                }
            },
        },
    },
}

SEND_NOTIFICATION_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "send_notification",
        "description": "Send a local push notification to the user's device with a title and body.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Notification title"},
                "body": {"type": "string", "description": "Notification body text"},
            },
            "required": ["title", "body"],
        },
    },
}

GET_CLIPBOARD_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_clipboard",
        "description": "Read the current text content from the user's clipboard.",
        "parameters": {"type": "object", "properties": {}},
    },
}

SET_CLIPBOARD_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "set_clipboard",
        "description": "Copy text to the user's clipboard.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "The text to copy to clipboard"}
            },
            "required": ["text"],
        },
    },
}

READ_FILE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "Read a file from the session's cloud file storage. Use this to read files uploaded by the user or previously saved by you.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path within the session (e.g. 'notes/todo.md', 'data.csv')",
                }
            },
            "required": ["path"],
        },
    },
}

WRITE_FILE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "write_file",
        "description": "Write or create a file in the session's cloud file storage. Creates the file if it doesn't exist, or overwrites if it does. Good for saving to-do lists, notes, code snippets, or any content the user may want to reference later.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path within the session (e.g. 'notes/todo.md')"},
                "content": {"type": "string", "description": "Text content to write"},
            },
            "required": ["path", "content"],
        },
    },
}

LIST_FILES_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "list_files",
        "description": "List all files in the session's cloud file storage, optionally filtered by directory path.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Optional directory prefix to filter (e.g. 'notes/'). Omit to list all files.",
                }
            },
        },
    },
}

DELETE_FILE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "delete_file",
        "description": "Delete a file from the session's cloud file storage.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to delete (e.g. 'notes/old-todo.md')",
                }
            },
            "required": ["path"],
        },
    },
}

SEND_SMS_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "send_sms",
        "description": "Open the SMS compose screen with pre-filled recipients and message. The user must manually confirm sending.",
        "parameters": {
            "type": "object",
            "properties": {
                "phones": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Phone number(s) to send to",
                },
                "message": {"type": "string", "description": "Message text to pre-fill"},
            },
            "required": ["phones", "message"],
        },
    },
}

SHARE_CONTENT_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "share_content",
        "description": "Open the native share sheet to share text or a URL with other apps.",
        "parameters": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Text content to share"},
                "url": {"type": "string", "description": "Optional URL to share"},
            },
            "required": ["message"],
        },
    },
}

TRIGGER_HAPTIC_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "trigger_haptic",
        "description": "Trigger haptic feedback (vibration) on the user's device.",
        "parameters": {
            "type": "object",
            "properties": {
                "style": {
                    "type": "string",
                    "enum": ["light", "medium", "heavy"],
                    "description": "Intensity of the haptic feedback. Defaults to medium.",
                }
            },
        },
    },
}

OPEN_URL_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "open_url",
        "description": "Open a URL in the device's in-app browser.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to open"}
            },
            "required": ["url"],
        },
    },
}

MANAGE_TODO_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "manage_todo",
        "description": (
            "Create or update a TODO execution plan for the current task. "
            "Use this for multi-step tasks to plan before executing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create", "update_step", "add_steps"],
                    "description": "Action to perform",
                },
                "task": {
                    "type": "string",
                    "description": "Overall task description (required for 'create')",
                },
                "steps": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Step descriptions (required for 'create' and 'add_steps')",
                },
                "step_index": {
                    "type": "integer",
                    "description": "Index of step to update (required for 'update_step')",
                },
                "status": {
                    "type": "string",
                    "enum": ["in_progress", "completed", "failed"],
                    "description": "New status for the step (required for 'update_step')",
                },
                "result": {
                    "type": "string",
                    "description": "Brief result description for completed/failed steps",
                },
                "after_index": {
                    "type": "integer",
                    "description": "Insert new steps after this index (for 'add_steps', defaults to end)",
                },
            },
            "required": ["action"],
        },
    },
}

MANAGE_PERIODIC_TASK_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "manage_periodic_task",
        "description": (
            "Register, list, or manage periodic (scheduled) tasks. "
            "Use this after successfully completing a dry run of a repeating task "
            "to register it as a periodic task that runs automatically on schedule."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["register", "list", "cancel", "pause", "resume"],
                    "description": "Action to perform on periodic tasks",
                },
                "title": {
                    "type": "string",
                    "description": "Short title for the periodic task (required for 'register')",
                },
                "description": {
                    "type": "string",
                    "description": "Longer description of what the task does (for 'register')",
                },
                "recipe": {
                    "type": "object",
                    "description": (
                        "Execution recipe JSON learned from the dry run (required for 'register'). "
                        "Must include: objective, instructions (array), tools_required (array), "
                        "output_spec (object with file_pattern and summary_template), "
                        "dry_run_result (object with success boolean and sample_output_path)"
                    ),
                },
                "schedule": {
                    "type": "object",
                    "description": (
                        "Schedule specification (required for 'register'). "
                        'Example: {"type": "cron", "cron": {"minute": 0, "hour": 9, '
                        '"day_of_month": "*", "month": "*", "day_of_week": "*"}}'
                    ),
                },
                "timezone": {
                    "type": "string",
                    "description": "IANA timezone for the schedule (default: Asia/Seoul)",
                },
                "task_id": {
                    "type": "string",
                    "description": "ID of the periodic task (required for 'cancel', 'pause', 'resume')",
                },
                "notify_on_success": {
                    "type": "boolean",
                    "description": (
                        "Whether to send a system notification when the task completes successfully. "
                        "Set to false if the task already sends its own notification via notify_user. "
                        "Default: true. Only used with 'register' action."
                    ),
                },
            },
            "required": ["action"],
        },
    },
}

NOTIFY_USER_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "notify_user",
        "description": (
            "Send a push notification to the user. Use this to deliver results, "
            "alerts, or updates directly to the user's devices. "
            "Periodic tasks MUST call this at the end to report their results."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Notification title (short, descriptive)",
                },
                "body": {
                    "type": "string",
                    "description": "Notification body with the detailed message or results",
                },
            },
            "required": ["title", "body"],
        },
    },
}

# Map tool names to their schemas for clean lookup
TOOL_SCHEMA_MAP = {
    "bash": BASH_TOOL_SCHEMA,
    "ask_question": ASK_QUESTION_TOOL_SCHEMA,
    "select_cwd": SELECT_CWD_TOOL_SCHEMA,
    "browser_navigate": BROWSER_NAVIGATE_TOOL_SCHEMA,
    "browser_new_tab": BROWSER_NEW_TAB_TOOL_SCHEMA,
    "browser_click": BROWSER_CLICK_TOOL_SCHEMA,
    "browser_type": BROWSER_TYPE_TOOL_SCHEMA,
    "browser_get_content": BROWSER_GET_CONTENT_TOOL_SCHEMA,
    "get_device_info": GET_DEVICE_INFO_TOOL_SCHEMA,
    "get_sensor_data": GET_SENSOR_DATA_TOOL_SCHEMA,
    "get_contacts": GET_CONTACTS_TOOL_SCHEMA,
    "get_location": GET_LOCATION_TOOL_SCHEMA,
    "take_photo": TAKE_PHOTO_TOOL_SCHEMA,
    "send_notification": SEND_NOTIFICATION_TOOL_SCHEMA,
    "get_clipboard": GET_CLIPBOARD_TOOL_SCHEMA,
    "set_clipboard": SET_CLIPBOARD_TOOL_SCHEMA,
    "read_file": READ_FILE_TOOL_SCHEMA,
    "write_file": WRITE_FILE_TOOL_SCHEMA,
    "list_files": LIST_FILES_TOOL_SCHEMA,
    "delete_file": DELETE_FILE_TOOL_SCHEMA,
    "send_sms": SEND_SMS_TOOL_SCHEMA,
    "share_content": SHARE_CONTENT_TOOL_SCHEMA,
    "trigger_haptic": TRIGGER_HAPTIC_TOOL_SCHEMA,
    "open_url": OPEN_URL_TOOL_SCHEMA,
    "manage_todo": MANAGE_TODO_TOOL_SCHEMA,
    "manage_periodic_task": MANAGE_PERIODIC_TASK_TOOL_SCHEMA,
    "notify_user": NOTIFY_USER_TOOL_SCHEMA,
}
