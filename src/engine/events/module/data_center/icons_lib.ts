type IconKey = 'save' | 'load' | 'time' | 'delete' | 'success' | 'attach' | 'question' |
               'stop' | 'reconfig' | 'config' | 'help' | 'next' | 'message' | 'money' |
               'card' | 'cardg' | 'medal' | 'person' | 'edit' | 'back' | 'warn' |
               'status' | 'work' | 'facult' | 'statistics' | 'alliance' | 'add' | 'date' |
               'converter' | 'run' | 'persons' | 'monitor' | 'limit' | 'like' | 'post' |
               'info' | 'lock' | 'change';

export const ico_list: { [key in IconKey]: { ico: string, name: string } } = {
    'save': { ico: '💾', name: '' },
    'add': { ico: '➕', name: '' },
    'edit': { ico: '✏', name: '' },
    'next': { ico: '→', name: '' },
    'back': { ico: '←', name: '' },
    'attach': { ico: '🧷', name: '' },
    'message': { ico: '💬', name: '' },
    'load': { ico: '⌛', name: '' },
    'time': { ico: '⏰', name: '' },
    'delete': { ico: '⛔', name: '' },
    'success': { ico: '✅', name: '' },
    'stop': { ico: '🚫', name: 'Стоп' },
    'reconfig': { ico: '🔧', name: '' },
    'config': { ico: '⚙', name: '' },
    'help': { ico: '💡', name: '' },
    'warn': { ico: '⚠', name: '' },
    'statistics': { ico: '📊', name: '' },
    'question': { ico: '⁉', name: '' },
    'converter': { ico: '⚖', name: '' },
    'run': { ico: '🚀', name: '' },
    'monitor': { ico: '🎥', name: '' },
    'limit': { ico: '🚧', name: '' },
    'like': { ico: '👍', name: '' },
    'post': { ico: '📰', name: '' },
    'money': { ico: '💰', name: '' },
    'date': { ico: '⚰', name: '' },
    'info': { ico: '📜', name: '' },
    'lock': { ico: '🔒', name: '' },
    'change': { ico: '🔃', name: '' },
    //'': { ico: '🔃', name: '' },
    'alliance': { ico: '🌐', name: '' },
    'card': { ico: '💳', name: '' },
    'cardg': { ico: '🕯', name: '' },
    'medal': { ico: '🔘', name: '' },
    'person': { ico: '👤', name: '' },
    'persons': { ico: '👥', name: '' },
    'status': { ico: '👑', name: '' },
    'work': { ico: '🔨', name: '' },
    'facult': { ico: '🔮', name: '' }
};