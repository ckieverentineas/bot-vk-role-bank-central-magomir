type IconKey = 'save' | 'load' | 'time' | 'delete' | 'success' | 'attach' | 'question' |
               'cancel' | 'reconfig' | 'config' | 'help' | 'next' | 'message' |
               'card' | 'cardg' | 'medal' | 'person' | 'edit' | 'back' | 'warn' |
               'status' | 'work' | 'facult' | 'statistics' | 'alliance' | 'add' |
               'converter' | 'run' | 'persons';

export const ico_list: { [key in IconKey]: { ico: string } } = {
    'save': { ico: '💾' },
    'add': { ico: '➕' },
    'edit': { ico: '✏' },
    'next': { ico: '→' },
    'back': { ico: '←' },
    'attach': { ico: '🧷' },
    'message': { ico: '💬' },
    'load': { ico: '⌛' },
    'time': { ico: '⏰' },
    'delete': { ico: '⛔' },
    'success': { ico: '✅' },
    'cancel': { ico: '🚫' },
    'reconfig': { ico: '🔧' },
    'config': { ico: '⚙' },
    'help': { ico: '💡' },
    'warn': { ico: '⚠' },
    'statistics': { ico: '📊' },
    'question': { ico: '⁉' },
    'converter': { ico: '⚖' },
    'run': { ico: '🚀' },

    'alliance': { ico: '🌐' },
    'card': { ico: '💳' },
    'cardg': { ico: '🕯' },
    'medal': { ico: '🔘' },
    'person': { ico: '👤' },
    'persons': { ico: '👥' },
    'status': { ico: '👑' },
    'work': { ico: '🔨' },
    'facult': { ico: '🔮' }
};