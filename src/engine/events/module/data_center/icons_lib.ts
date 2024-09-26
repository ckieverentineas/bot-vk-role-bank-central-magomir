type IconKey = 'save' | 'load' | 'time' | 'delete' | 'success' | 
               'cancel' | 'reconfig' | 'config' | 'help' | 
               'card' | 'cardg' | 'medal' | 'person' | 
               'status' | 'work' | 'facult';

export const ico_list: { [key in IconKey]: { ico: string } } = {
    'save': { ico: '💾' },
    'load': { ico: '⌛' },
    'time': { ico: '⏰' },
    'delete': { ico: '⛔' },
    'success': { ico: '✅' },
    'cancel': { ico: '🚫' },
    'reconfig': { ico: '🔧' },
    'config': { ico: '⚙' },
    'help': { ico: '💡' },
    'card': { ico: '💳' },
    'cardg': { ico: '🕯' },
    'medal': { ico: '🔘' },
    'person': { ico: '👤' },
    'status': { ico: '👑' },
    'work': { ico: '🔨' },
    'facult': { ico: '🔮' }
};