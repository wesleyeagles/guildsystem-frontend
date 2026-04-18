/**
 * Single source for i18n keys. Run: node scripts/generate-i18n.mjs
 * Writes public/i18n/pt-BR.json, en.json, ru.json
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'i18n');

const dict = {
  ptBR: {},
  en: {},
  ru: {},
};

function add(path, pt, en, ru) {
  const parts = path.split('.');
  for (const [lang, val] of [
    ['ptBR', pt],
    ['en', en],
    ['ru', ru],
  ]) {
    let o = dict[lang];
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      o[p] ??= {};
      o = o[p];
    }
    o[parts[parts.length - 1]] = val;
  }
}

// --- Existing + common
add('brand.subtitle', 'Guild System', 'Guild System', 'Guild System');
add('user.pointsLabel', 'Pts:', 'Pts:', 'Очки:');
add('sidebar.newEvent', '+ Novo evento', '+ New event', '+ Новое событие');
add('nav.home', 'Início', 'Home', 'Главная');
add('nav.dashboard', 'Dashboard', 'Dashboard', 'Панель');
add('nav.members', 'Membros', 'Members', 'Участники');
add('nav.events', 'Eventos', 'Events', 'События');
add('nav.auctions', 'Leilões', 'Auctions', 'Аукционы');
add('nav.eventsPending', 'Eventos pendentes', 'Pending events', 'Ожидающие события');
add('nav.donations', 'Doações', 'Donations', 'Пожертвования');
add('nav.logs', 'Logs', 'Logs', 'Логи');
add('mod.createObjective', 'Criar objetivo', 'Create objective', 'Создать цель');
add('mod.createEvent', 'Criar evento', 'Create event', 'Создать событие');
add('mod.eventsApproval', 'Eventos para aprovação', 'Events for approval', 'События на одобрение');
add('mod.createAuction', 'Criar leilão', 'Create auction', 'Создать аукцион');
add('mod.createItem', 'Criar item', 'Create item', 'Создать предмет');
add('mod.permissions', 'Permissões', 'Permissions', 'Права');
add('mod.membersPending', 'Membros pendentes', 'Pending members', 'Ожидающие участники');
add('donation.donate', 'Doar', 'Donate', 'Пожертвовать');
add('donation.pending', 'Pendente', 'Pending', 'В ожидании');
add(
  'donation.cooldownHoursMinutes',
  'Pode doar em {{hours}}h {{minutes}}m',
  'Can donate in {{hours}}h {{minutes}}m',
  'Можно пожертвовать через {{hours}}ч {{minutes}}м',
);
add(
  'donation.cooldownMinutes',
  'Pode doar em {{minutes}}m',
  'Can donate in {{minutes}}m',
  'Можно пожертвовать через {{minutes}}м',
);
add('theme.light', 'Tema claro', 'Light theme', 'Светлая тема');
add('theme.dark', 'Tema escuro', 'Dark theme', 'Тёмная тема');
add('theme.ariaLight', 'Ativar tema claro', 'Switch to light theme', 'Включить светлую тему');
add('theme.ariaDark', 'Ativar tema escuro', 'Switch to dark theme', 'Включить тёмную тему');
add('language.label', 'Idioma', 'Language', 'Язык');
add('language.pt', 'Português', 'Português', 'Português');
add('language.en', 'English', 'English', 'English');
add('language.ru', 'Русский', 'Русский', 'Русский');
add(
  'boot.subtitle',
  '-=BlackLisT=- • Guild System',
  '-=BlackLisT=- • Guild System',
  '-=BlackLisT=- • Guild System',
);
add('boot.consoleTitle', 'Console do Sistema', 'System console', 'Системная консоль');
add('boot.checkingCredentials', 'Verificando credenciais', 'Verifying credentials', 'Проверка учётных данных');
add('boot.syncingTokens', 'Sincronizando tokens', 'Syncing tokens', 'Синхронизация токенов');
add('boot.connectingServer', 'Conectando ao servidor', 'Connecting to server', 'Подключение к серверу');
add('boot.preparingUi', 'Preparando interface', 'Preparing interface', 'Подготовка интерфейса');
add('boot.waitingServer', 'Aguardando resposta do servidor', 'Waiting for server response', 'Ожидание ответа сервера');

// common
add('common.search', 'Buscar...', 'Search...', 'Поиск...');
add('common.cancel', 'Cancelar', 'Cancel', 'Отмена');
add('common.save', 'Salvar', 'Save', 'Сохранить');
add('common.saving', 'Salvando...', 'Saving...', 'Сохранение...');
add('common.back', 'Voltar', 'Back', 'Назад');
add('common.close', 'Fechar', 'Close', 'Закрыть');
add('common.loading', 'Carregando...', 'Loading...', 'Загрузка...');
add('common.loadMore', 'Carregar mais', 'Load more', 'Загрузить ещё');
add('common.retry', 'Tentar novamente', 'Try again', 'Повторить');
add('common.retryShort', 'tentar novamente', 'try again', 'повторить');
add('common.delete', 'Excluir', 'Delete', 'Удалить');
add('common.edit', 'Editar', 'Edit', 'Изменить');
add('common.create', 'Criar', 'Create', 'Создать');
add('common.creating', 'Criando...', 'Creating...', 'Создание...');
add('common.actions', 'Ações', 'Actions', 'Действия');
add('common.view', 'Ver', 'View', 'Просмотр');
add('common.points', 'Pontos', 'Points', 'Очки');
add('common.status', 'Status', 'Status', 'Статус');
add('common.event', 'Evento', 'Event', 'Событие');
add('common.date', 'Data', 'Date', 'Дата');
add('common.when', 'Quando', 'When', 'Когда');
add('common.delta', 'Delta', 'Delta', 'Изменение');
add('common.title', 'Título', 'Title', 'Заголовок');
add('common.all', 'Todos', 'All', 'Все');
add('common.page', 'Página', 'Page', 'Страница');
add('common.perPage', 'Por página', 'Per page', 'На странице');
add('common.prev', 'Anterior', 'Previous', 'Назад');
add('common.next', 'Próximo', 'Next', 'Вперёд');
add('common.unknown', 'Unknown', 'Unknown', 'Неизвестно');
add('common.emDash', '—', '—', '—');
add('common.brasilia', '(Brasília)', '(Brasília)', '(Бразилия)');
add('common.yes', 'Sim', 'Yes', 'Да');
add('common.no', 'Não', 'No', 'Нет');
add('common.add', 'Adicionar', 'Add', 'Добавить');
add('common.remove', 'Remover', 'Remove', 'Убрать');
add('common.submitting', 'Enviando...', 'Sending...', 'Отправка...');
add('common.sending', 'Enviando...', 'Sending...', 'Отправка...');
add('common.publish', 'Publicar', 'Publish', 'Опубликовать');
add('common.quantity', 'Quantidade', 'Quantity', 'Количество');

// table / data-table
add('table.noRows', 'Nenhum dado encontrado', 'No data found', 'Данных не найдено');
add('table.pageOf', 'Página {{current}} / {{total}}', 'Page {{current}} / {{total}}', 'Стр. {{current}} / {{total}}');
add('table.rowRange', '{{start}}–{{end}} de {{total}}', '{{start}}–{{end}} of {{total}}', '{{start}}–{{end}} из {{total}}');
add('table.rowRangeEmpty', '0 de 0', '0 of 0', '0 из 0');

// app shell
add('shell.openMenu', 'Abrir menu', 'Open menu', 'Открыть меню');
add('shell.closeMenu', 'Fechar menu', 'Close menu', 'Закрыть меню');

// login / register / auth
add('login.title', 'Painel da Guild', 'Guild panel', 'Панель гильдии');
add('login.subtitle', 'Entre com sua conta Discord para continuar', 'Sign in with Discord to continue', 'Войдите через Discord, чтобы продолжить');
add('login.openingDiscord', 'Abrindo Discord...', 'Opening Discord...', 'Открытие Discord...');
add('login.withDiscord', 'Entrar com Discord', 'Sign in with Discord', 'Войти через Discord');
add('login.footer', 'Acesso restrito a membros autorizados da guild.', 'Access restricted to authorized guild members.', 'Доступ только для авторизованных участников гильдии.');
add('login.logoAlt', 'Logo da Guild', 'Guild logo', 'Логотип гильдии');
add('login.errorFallback', 'Falha no login', 'Login failed', 'Ошибка входа');
add('login.pendingApproval', 'Conta pendente de aprovação. Aguarde a aceitação do administrador.', 'Account pending approval. Please wait for an administrator.', 'Аккаунт ожидает одобрения администратора.');

add('register.title', 'Criar conta', 'Create account', 'Создать аккаунт');
add('register.lead', 'Cadastre-se para acessar o sistema', 'Register to access the system', 'Зарегистрируйтесь для доступа');
add('register.nickname', 'Nickname', 'Nickname', 'Никнейм');
add('register.email', 'Email', 'Email', 'Email');
add('register.password', 'Senha', 'Password', 'Пароль');
add('register.errNickname', 'Informe seu nickname.', 'Enter your nickname.', 'Укажите никнейм.');
add('register.errEmail', 'Informe um email válido.', 'Enter a valid email.', 'Укажите корректный email.');
add('register.errPassword', 'A senha deve ter no mínimo 8 caracteres.', 'Password must be at least 8 characters.', 'Пароль не короче 8 символов.');
add('register.submit', 'Cadastrar', 'Register', 'Зарегистрироваться');
add('register.submitting', 'Cadastrando...', 'Registering...', 'Регистрация...');
add('register.hasAccount', 'Já tem conta?', 'Already have an account?', 'Уже есть аккаунт?');
add('register.signIn', 'Entrar', 'Sign in', 'Войти');
add('register.toastSent', 'Cadastro enviado. Aguarde a aprovação do administrador.', 'Registration submitted. Please wait for administrator approval.', 'Заявка отправлена. Дождитесь одобрения администратора.');
add('register.errorFallback', 'Falha ao cadastrar', 'Registration failed', 'Ошибка регистрации');

add('waiting.title', 'Cadastro enviado', 'Registration submitted', 'Заявка отправлена');
add(
  'waiting.body1',
  'Sua conta foi criada com sucesso, mas ainda precisa ser aceita por um administrador.',
  'Your account was created but still needs to be accepted by an administrator.',
  'Аккаунт создан, но его должен принять администратор.',
);
add('waiting.body2', 'Assim que for aprovada, você poderá fazer login normalmente.', 'Once approved, you can log in as usual.', 'После одобрения вы сможете войти как обычно.');
add('waiting.backLogin', 'Voltar para login', 'Back to login', 'Ко входу');

add('authDiscord.title', 'Conectando com Discord', 'Connecting to Discord', 'Подключение к Discord');
add('authDiscord.wait', 'Aguarde um instante...', 'Please wait...', 'Подождите...');
add('authDiscord.retry', 'Tentar de novo', 'Try again', 'Повторить');
add('authDiscord.backLogin', 'Voltar pro login', 'Back to login', 'Ко входу');
add('authDiscord.rateLimited', 'Discord rate limited', 'Discord rate limited', 'Лимит запросов Discord');
add('authDiscord.authError', 'Erro ao autenticar com discord', 'Error authenticating with Discord', 'Ошибка авторизации Discord');
add(
  'authDiscord.rateLimitError',
  'Rate limit do Discord. Aguarde {{sec}}s e tente novamente.',
  'Discord rate limit. Wait {{sec}}s and try again.',
  'Лимит Discord. Подождите {{sec}}с и повторите.',
);

// home / news
add('home.title', 'Notícias', 'News', 'Новости');
add('home.subtitle', 'Atualizações e avisos.', 'Updates and notices.', 'Обновления и объявления.');
add('home.newPost', 'Nova notícia', 'New post', 'Новая новость');
add('home.loading', 'Carregando notícias…', 'Loading news…', 'Загрузка новостей…');
add('home.empty', 'Sem notícias por enquanto.', 'No news yet.', 'Пока нет новостей.');
add('home.loadError', 'Não foi possível carregar as notícias.', 'Could not load news.', 'Не удалось загрузить новости.');
add('home.tagImportant', 'IMPORTANTE!', 'IMPORTANT!', 'ВАЖНО!');
add('home.editNews', 'Editar notícia', 'Edit news', 'Редактировать новость');
add('home.deleteNews', 'Excluir notícia', 'Delete news', 'Удалить новость');
add('home.launchTitle', 'Abertura do servidor', 'Server opening', 'Открытие сервера');
add('home.launchSubtitle', 'RF Reuleaux — 25/04/2026 às 06:00 (Brasília)', 'RF Reuleaux — 04/25/2026 at 06:00 (Brasília)', 'RF Reuleaux — 25.04.2026 в 06:00 (Бразилия)');
add('home.launchDone', 'Servidor aberto — boa sorte!', 'Server is open — good luck!', 'Сервер открыт — удачи!');
add('home.countdownDay', 'Dia', 'Day', 'День');
add('home.countdownDays', 'Dias', 'Days', 'Дней');
add('home.countdownHour', 'Hora', 'Hour', 'Час');
add('home.countdownHours', 'Horas', 'Hours', 'Часов');
add('home.countdownMinute', 'Minuto', 'Minute', 'Минута');
add('home.countdownMinutes', 'Minutos', 'Minutes', 'Минут');
add('home.countdownSecond', 'Segundo', 'Second', 'Секунда');
add('home.countdownSeconds', 'Segundos', 'Seconds', 'Секунд');
add('home.countdownExpiredSr', 'O servidor já está aberto.', 'The server is already open.', 'Сервер уже открыт.');
add(
  'home.modalTitleNew',
  'Nova notícia',
  'New post',
  'Новая новость',
);
add('home.modalTitleEdit', 'Editar notícia', 'Edit news', 'Редактировать новость');
add('home.fieldTitle', 'Título', 'Title', 'Заголовок');
add('home.fieldTag', 'Tag', 'Tag', 'Тег');
add('home.fieldImportant', 'Marcar como importante', 'Mark as important', 'Пометить как важное');
add('home.fieldText', 'Texto', 'Text', 'Текст');
add(
  'home.quillPlaceholder',
  'Escreva a notícia… Use a barra para negrito, links, listas, etc.',
  'Write the news… Use the toolbar for bold, links, lists, etc.',
  'Напишите новость… Панель: жирный, ссылки, списки и т.д.',
);
add('home.deleteConfirmTitle', 'Excluir notícia', 'Delete news', 'Удалить новость');
add(
  'home.deleteConfirmMsg',
  'Deseja excluir esta notícia? Esta ação não pode ser desfeita.',
  'Delete this news post? This cannot be undone.',
  'Удалить эту новость? Действие необратимо.',
);
add('home.errCreate', 'Não foi possível criar a notícia. Verifique se você tem permissão.', 'Could not create the post. Check your permissions.', 'Не удалось создать новость. Проверьте права.');
add('home.errSave', 'Não foi possível salvar a notícia. Verifique se você tem permissão.', 'Could not save the post. Check your permissions.', 'Не удалось сохранить новость. Проверьте права.');
add('home.errDelete', 'Não foi possível excluir. Verifique se você tem permissão.', 'Could not delete. Check your permissions.', 'Не удалось удалить. Проверьте права.');

// dashboard
add('dashboard.title', 'Dashboard', 'Dashboard', 'Панель');
add('dashboard.col.rank', '#', '#', '#');
add('dashboard.col.member', 'Membro', 'Member', 'Участник');
add('dashboard.col.points', 'Pontos', 'Points', 'Очки');
add('dashboard.col.lastEvent', 'Último evento', 'Last event', 'Последнее событие');
add('dashboard.col.event', 'Evento', 'Event', 'Событие');
add('dashboard.col.expires', 'Expira', 'Expires', 'Истекает');
add('dashboard.claim', 'Reivindicar', 'Claim', 'Забрать');
add('dashboard.errMembers', 'Falha ao carregar membros', 'Failed to load members', 'Не удалось загрузить участников');
add('dashboard.errEvents', 'Falha ao carregar eventos', 'Failed to load events', 'Не удалось загрузить события');

// members list
add('members.title', 'Membros', 'Members', 'Участники');
add('members.errLoad', 'Falha ao carregar membros', 'Failed to load members', 'Не удалось загрузить участников');
add('members.col.member', 'Membro', 'Member', 'Участник');
add('members.col.lastEvent', 'Último evento', 'Last event', 'Последнее событие');

// member details
add('member.profile', 'Perfil', 'Profile', 'Профиль');
add('member.changeNickname', 'Alterar nickname', 'Change nickname', 'Сменить никнейм');
add('member.role', 'Cargo', 'Role', 'Роль');
add('member.points', 'Pontos', 'Points', 'Очки');
add('member.eventsJoined', 'Eventos participados', 'Events joined', 'Событий участвовал');
add('member.pointsSpent', 'Pontos gastos', 'Points spent', 'Потрачено очков');
add('member.warnings', 'Avisos', 'Warnings', 'Предупреждения');
add('member.lastLogin', 'Último login', 'Last login', 'Последний вход');
add('member.admin', 'Admin', 'Admin', 'Админ');
add('member.manualParticipation', 'Adicionar participação manual.', 'Add manual participation.', 'Добавить участие вручную.');
add('member.eventTitlePh', 'Título do evento', 'Event title', 'Название события');
add('member.pointsPh', 'Pontos', 'Points', 'Очки');
add('member.removePoints', 'Remover pontos', 'Remove points', 'Снять очки');
add('member.removeQtyPh', 'Quantidade', 'Amount', 'Количество');
add('member.removeTitlePh', 'Título do log (ex: Remoção manual)', 'Log title (e.g. manual removal)', 'Заголовок лога (напр. ручное снятие)');
add('member.tabEvents', 'Eventos', 'Events', 'События');
add('member.tabPoints', 'Pontos', 'Points', 'Очки');
add('member.tabNicknames', 'Nicknames', 'Nicknames', 'Никнеймы');
add('member.logsTitle', 'Logs', 'Logs', 'Логи');
add('member.nickLoading', 'Carregando...', 'Loading...', 'Загрузка...');
add('member.nickEmpty', 'Nenhuma alteração de nickname registrada.', 'No nickname changes recorded.', 'Нет записей о смене никнейма.');

add('member.col.status', 'Status', 'Status', 'Статус');
add('member.col.event', 'Evento', 'Event', 'Событие');
add('member.col.date', 'Data', 'Date', 'Дата');
add('member.col.when', 'Quando', 'When', 'Когда');
add('member.col.delta', 'Delta', 'Delta', 'Изм.');
add('member.col.beforeAfter', 'Antes → Depois', 'Before → After', 'Было → Стало');
add('member.col.who', 'Quem', 'Who', 'Кто');
add('member.col.titleReason', 'Título / Motivo', 'Title / Reason', 'Заголовок / причина');

// logs page
add('logs.title', 'Logs', 'Logs', 'Логи');
add('logs.col.base', 'Base', 'Base', 'База');
add('logs.col.pilotBonus', 'Bônus por alt', 'Alt bonus', 'Бонус за alt');
add('logs.col.createdBy', 'Criado por', 'Created by', 'Создал');
add('logs.col.claimedBy', 'Reivindicado por', 'Claimed by', 'Забрал');
add('logs.col.claimedAt', 'Reivindicado em', 'Claimed at', 'Когда забрал');
add('logs.errLoad', 'Falha ao carregar logs', 'Failed to load logs', 'Не удалось загрузить логи');
add('logs.reverseFail', 'Falha ao cancelar claim', 'Failed to cancel claim', 'Не удалось отменить claim');
add('logs.noPermission', 'Sem permissão.', 'No permission.', 'Нет прав.');
add(
  'logs.toastAlreadyReversed',
  'Esse claim já estava cancelado.',
  'This claim was already cancelled.',
  'Этот claim уже был отменён.',
);
add(
  'logs.toastReversed',
  'Claim cancelado. -{{pts}} pontos removidos.',
  'Claim cancelled. -{{pts}} points removed.',
  'Claim отменён. Снято {{pts}} очков.',
);
add('logs.claimsTitle', 'Logs de Claims', 'Claim logs', 'Логи claim');
add('logs.subtitle', 'Registros de quem reivindicou eventos.', 'Records of who claimed events.', 'Кто забрал события.');
add('logs.tabAll', 'Todos', 'All', 'Все');
add('logs.tabActive', 'Ativos', 'Active', 'Активные');
add('logs.tabReversed', 'Revertidos', 'Reversed', 'Отменённые');
add('logs.colStatus', 'Status', 'Status', 'Статус');
add('logs.colEvent', 'Evento', 'Event', 'Событие');
add('logs.colActions', 'Ações', 'Actions', 'Действия');
add('logs.statusActive', 'Ativo', 'Active', 'Активно');
add('logs.statusReversed', 'Revertido', 'Reversed', 'Отменено');
add('logs.eventFallback', 'Evento #{{id}}', 'Event #{{id}}', 'Событие #{{id}}');
add('logs.reasonPlaceholder', 'Motivo (opcional)', 'Reason (optional)', 'Причина (необязательно)');
add('logs.cancelClaim', 'Cancelar reivindicação', 'Cancel claim', 'Отменить claim');
add('logs.filterPage', 'Filtrar nesta página...', 'Filter on this page...', 'Фильтр на странице...');

add('common.recordsCount', '{{count}} registro(s)', '{{count}} record(s)', '{{count}} записей');
add('common.ready', 'Pronto', 'Ready', 'Готово');

add('pendingMembers.title', 'Membros pendentes', 'Pending members', 'Ожидающие участники');
add(
  'pendingMembers.subtitle',
  'Aceite os usuários que se registraram e ainda não foram aprovados.',
  'Accept users who registered and are not approved yet.',
  'Примите пользователей, зарегистрировавшихся и ещё не одобренных.',
);

add('permissions.title', 'Permissões', 'Permissions', 'Права');
add('permissions.subtitle', 'Gerencie as roles dos membros.', "Manage members' roles.", 'Роли участников.');
add('permissions.you', 'Você:', 'You:', 'Вы:');
add('permissions.scope', 'Scope:', 'Scope:', 'Scope:');

add('items.pageTitle', 'Items', 'Items', 'Предметы');
add('items.totalLine', 'Total:', 'Total:', 'Всего:');
add(
  'items.searchToolbar',
  'Buscar por nome/descrição...',
  'Search by name/description...',
  'Поиск по имени/описанию...',
);
add('items.allCategories', 'Todas categorias', 'All categories', 'Все категории');
add('items.filter', 'Filtrar', 'Filter', 'Фильтр');
add('items.clear', 'Limpar', 'Clear', 'Сброс');
add('items.new', '+ Novo', '+ New', '+ Новый');
add('items.pageOf', 'Página {{page}} de {{totalPages}}', 'Page {{page}} of {{totalPages}}', 'Стр. {{page}} из {{totalPages}}');
add('items.prev', 'Anterior', 'Previous', 'Назад');
add('items.next', 'Próxima', 'Next', 'Вперёд');
add('items.category', 'Categoria', 'Category', 'Категория');
add('items.selectPh', 'Selecione...', 'Select...', 'Выберите...');
add('items.categoryLocked', '(Categoria travada no edit)', '(Category locked when editing)', '(категория заблокирована при правке)');
add('items.name', 'Nome', 'Name', 'Имя');
add('items.namePh', 'Nome do item', 'Item name', 'Название предмета');
add('items.quantity', 'Quantidade', 'Quantity', 'Кол-во');
add('items.description', 'Descrição', 'Description', 'Описание');
add('items.descPh', 'Descrição...', 'Description...', 'Описание...');
add('items.image', 'Imagem', 'Image', 'Изображение');
add('items.race', 'Raça', 'Race', 'Раса');
add('items.level', 'Level', 'Level', 'Уровень');
add('items.grade', 'Grade', 'Grade', 'Грейд');
add('items.type', 'Tipo', 'Type', 'Тип');
add('items.cast', 'Cast', 'Cast', 'Cast');
add('items.armorClass', 'Armor Class', 'Armor Class', 'Класс брони');
add('items.elementsPick', 'Elements (até 4)', 'Elements (up to 4)', 'Стихии (до 4)');
add('items.effects', 'Efeitos', 'Effects', 'Эффекты');
add('items.addEffect', '+ Adicionar Efeito', '+ Add effect', '+ Эффект');
add('items.effectPh', 'Ex: Critical +5', 'E.g. Critical +5', 'Напр. Critical +5');
add('items.remove', 'Remover', 'Remove', 'Убрать');
add('items.cancel', 'Cancelar', 'Cancel', 'Отмена');
add('items.saving', 'Salvando...', 'Saving...', 'Сохранение...');
add('items.create', 'Criar', 'Create', 'Создать');
add('items.save', 'Salvar', 'Save', 'Сохранить');

add('casts.pageTitle', 'Casts', 'Casts', 'Касты');
add('casts.tabAll', 'Todos', 'All', 'Все');
add('shields.pageTitle', 'Shields', 'Shields', 'Щиты');
add('accessories.pageTitle', 'Accessories', 'Accessories', 'Аксессуары');

add('eventsAdmin.labelObjective', 'Objetivo', 'Objective', 'Цель');
add('eventsAdmin.labelPassword', 'Senha', 'Password', 'Пароль');
add('eventsAdmin.labelDuration', 'Duração', 'Duration', 'Длительность');
add('eventsAdmin.pilotBonusLabel', 'Bônus piloto (pontos)', 'Pilot bonus (points)', 'Бонус пилота (очки)');
add('eventsAdmin.pilotMinErr', 'Mínimo 1.', 'Minimum 1.', 'Минимум 1.');
add('eventsAdmin.doubled', 'Dobrado (2x)', 'Doubled (2x)', 'Удвоено (2x)');
add('eventsAdmin.allowPilotLabel', 'Bônus para alt', 'Alt bonus', 'Бонус за alt');
add('eventsAdmin.creating', 'Criando...', 'Creating...', 'Создание...');

add('eventsClaims.title', 'Claims de eventos', 'Event claims', 'Claims событий');
add(
  'eventsClaims.subtitle',
  'Todos os claims enviados por todos os usuários',
  'All claims from all users',
  'Все claims от всех пользователей',
);
add('eventsClaims.tabAll', 'Todos', 'All', 'Все');
add('eventsClaims.tabPending', 'Pendentes', 'Pending', 'В ожидании');
add('eventsClaims.tabApproved', 'Aprovados', 'Approved', 'Одобрено');
add('eventsClaims.tabRejected', 'Rejeitados', 'Rejected', 'Отклонено');
add('eventsClaims.emptyTitle', 'Nada por aqui', 'Nothing here', 'Пусто');
add(
  'eventsClaims.emptySub',
  'Ainda não existem claims (ou nenhum bate com o filtro).',
  'No claims yet (or none match the filter).',
  'Пока нет claims (или ничего не подходит под фильтр).',
);
add('eventsClaims.zoomHint', 'Clique para ampliar', 'Click to enlarge', 'Клик — увеличить');
add('eventsClaims.noImage', 'Sem imagem', 'No image', 'Нет фото');
add('eventsClaims.user', 'Usuário', 'User', 'Пользователь');
add('eventsClaims.eventPoints', 'Pontos do evento', 'Event points', 'Очки события');
add('eventsClaims.base', 'Base:', 'Base:', 'База:');
add('eventsClaims.pilot', 'Piloto:', 'Pilot:', 'Пилот:');
add('eventsClaims.total', 'Total:', 'Total:', 'Итого:');
add('eventsClaims.approved', 'Aprovado', 'Approved', 'Одобрено');
add('eventsClaims.pending', 'Aguardando aprovação', 'Awaiting approval', 'Ожидает одобрения');
add('eventsClaims.rejected', 'Rejeitado', 'Rejected', 'Отклонено');
add('eventsClaims.reason', 'Motivo:', 'Reason:', 'Причина:');
add('eventsClaims.pointsGranted', 'Pontos:', 'Points:', 'Очки:');

add('eventsPilot.title', 'Claims com piloto', 'Pilot claims', 'Claims с пилотом');
add(
  'eventsPilot.subtitle',
  'Pendentes de aprovação • clique na imagem para ampliar',
  'Pending approval • click image to enlarge',
  'Ожидают одобрения • клик по фото для увеличения',
);
add('eventsPilot.totalPending', 'Total pendentes:', 'Total pending:', 'Всего в ожидании:');
add('eventsPilot.emptyTitle', 'Nada pendente 🎉', 'Nothing pending 🎉', 'Нет ожидающих 🎉');
add(
  'eventsPilot.emptySub',
  'Quando alguém enviar claim com piloto, vai aparecer aqui.',
  'When someone sends a pilot claim, it will show here.',
  'Когда придёт claim с пилотом, он появится здесь.',
);
add('eventsPilot.points', 'Pontos', 'Points', 'Очки');
add('eventsPilot.base', 'Base:', 'Base:', 'База:');
add('eventsPilot.bonus', 'Bonus:', 'Bonus:', 'Бонус:');
add('eventsPilot.total', 'Total:', 'Total:', 'Итого:');
add('eventsPilot.approve', 'Aprovar', 'Approve', 'Одобрить');
add('eventsPilot.reject', 'Rejeitar', 'Reject', 'Отклонить');
add('eventsPilot.processing', 'Processando...', 'Processing...', 'Обработка...');
add('eventsPilot.zoomHint', 'Clique para ampliar', 'Click to enlarge', 'Клик — увеличить');
add('eventsPilot.noImage', 'Sem imagem', 'No image', 'Нет фото');
add('eventsPilot.user', 'Usuário', 'User', 'Пользователь');
add(
  'eventsPilot.imageSubtitle',
  '{{nick}} • Claim #{{id}}',
  '{{nick}} • Claim #{{id}}',
  '{{nick}} • заявка #{{id}}',
);

add('auctionsAdmin.title', 'Admin · Leilões', 'Admin · Auctions', 'Админ · Аукционы');
add(
  'auctionsAdmin.subtitle',
  'Crie, edite, cancele e estenda leilões em tempo real.',
  'Create, edit, cancel and extend auctions in real time.',
  'Создание, правка, отмена и продление аукционов в реальном времени.',
);
add('auctionsAdmin.createAuction', '+ Criar leilão', '+ Create auction', '+ Создать аукцион');
add('auctionsAdmin.createTitle', 'Abrir modal (catálogo carrega dentro do modal)', 'Open modal (catalog loads inside)', 'Открыть модалку (каталог внутри)');
add('auctionsAdmin.listHeading', 'Lista de leilões', 'Auction list', 'Список аукционов');
add('auctionsAdmin.metaTotal', 'Total:', 'Total:', 'Всего:');
add('auctionsAdmin.metaPage', 'Página:', 'Page:', 'Стр.:');
add('auctionsAdmin.loadingList', 'Carregando leilões...', 'Loading auctions...', 'Загрузка аукционов...');
add('auctionsAdmin.loadingGrid', 'Carregando lista...', 'Loading list...', 'Загрузка списка...');
add('auctionsAdmin.lastBid', 'Último lance:', 'Last bid:', 'Последняя ставка:');
add('auctionsAdmin.tieLabel', 'Empate: {{n}}', 'Tie: {{n}}', 'Ничья: {{n}}');
add('auctionsAdmin.canceledLine', 'Cancelado:', 'Cancelled:', 'Отменено:');
add('auctionsAdmin.winnerLine', 'Vencedor:', 'Winner:', 'Победитель:');
add('auctionsAdmin.edit', 'Editar', 'Edit', 'Правка');
add('auctionsAdmin.extend', 'Estender', 'Extend', 'Продлить');
add('auctionsAdmin.cancelAuction', 'Cancelar', 'Cancel', 'Отмена');
add('auctionsAdmin.editTooltip', 'Editar', 'Edit', 'Правка');
add(
  'auctionsAdmin.extendTooltip',
  'Adiciona segundos no fim',
  'Add seconds at the end',
  'Добавить секунды в конце',
);
add('auctionsAdmin.modalItemType', 'Tipo de Item', 'Item type', 'Тип предмета');
add('auctionsAdmin.durationHoursLabel', 'Duração (horas)', 'Duration (hours)', 'Длительность (ч)');
add('auctionsAdmin.durationPh', 'Ex: 24', 'E.g. 24', 'Напр. 24');
add('auctionsAdmin.quickTestLabel', 'Teste rápido (minutos)', 'Quick test (minutes)', 'Быстрый тест (мин)');
add('auctionsAdmin.testOffPh', '0 = desativado', '0 = disabled', '0 = выкл');
add(
  'auctionsAdmin.testHint',
  'Se > 0, sobrescreve a duração em horas (só pra testes).',
  'If > 0, overrides duration in hours (testing only).',
  'Если > 0, перекрывает длительность в часах (только для тестов).',
);
add('auctionsAdmin.startsAtLabel', 'Começa em (opcional)', 'Starts at (optional)', 'Начало (опц.)');
add(
  'auctionsAdmin.startsAtHint',
  'Se vazio, começa imediatamente.',
  'If empty, starts immediately.',
  'Если пусто — начинается сразу.',
);
add(
  'auctionsAdmin.editModeHint',
  'Edição: altere título e item. Duração use “Estender”.',
  'Edit: change title and item. Use “Extend” for duration.',
  'Правка: заголовок и предмет. Длительность — «Продлить».',
);
add('auctionsAdmin.selectItemTitle', 'Selecione um item', 'Select an item', 'Выберите предмет');
add('auctionsAdmin.auctionPrefix', 'Leilão:', 'Auction:', 'Аукцион:');
add('auctionsAdmin.addSeconds', 'Adicionar segundos', 'Add seconds', 'Добавить секунды');
add('auctionsAdmin.cancelAuctionTitle', 'Cancelar leilão:', 'Cancel auction:', 'Отменить аукцион:');
add('auctionsAdmin.reasonLabel', 'Motivo', 'Reason', 'Причина');
add('auctionsAdmin.confirmCancelBtn', 'Confirmar cancelamento', 'Confirm cancellation', 'Подтвердить отмену');
add('auctionsAdmin.deleteHardTitle', 'Delete hard:', 'Delete hard:', 'Жёсткое удаление:');
add(
  'auctionsAdmin.deleteHardHint',
  'Só funciona se o leilão não tiver lances/holds. Se falhar, use Cancelar.',
  'Only works if the auction has no bids/holds. If it fails, use Cancel.',
  'Работает только без ставок/холдов. Иначе используйте «Отмена».',
);
add('auctionsAdmin.deleteBtn', 'Deletar', 'Delete', 'Удалить');

add(
  'auctionItemPicker.loadedCount',
  '({{count}} carregado(s))',
  '({{count}} loaded)',
  '({{count}} шт.)',
);
add('auctionItemPicker.clearTitle', 'Limpar seleção', 'Clear selection', 'Сбросить выбор');
add('auctionItemPicker.clearBtn', 'Limpar', 'Clear', 'Сброс');
add(
  'auctionItemPicker.searchPh',
  'Buscar (nome/código)...',
  'Search (name/code)...',
  'Поиск (название/код)...',
);
add('auctionItemPicker.loadingItems', 'Carregando itens...', 'Loading items...', 'Загрузка предметов...');
add('auctionItemPicker.empty', 'Nenhum item encontrado.', 'No items found.', 'Ничего не найдено.');
add('auctionItemPicker.noImg', 'sem img', 'no img', 'нет фото');
add('auctionItemPicker.selected', 'Selecionado', 'Selected', 'Выбрано');
add('auctionItemPicker.updating', 'Atualizando...', 'Updating...', 'Обновление...');
add('auctionItemPicker.loadMore', 'Carregar mais', 'Load more', 'Ещё');
add('auctionItemPicker.endOfList', 'Fim da lista', 'End of list', 'Конец списка');

add('pendingMembers.colNickname', 'Nickname', 'Nickname', 'Ник');
add('pendingMembers.colEmail', 'Email', 'Email', 'Email');
add('pendingMembers.colCreated', 'Criado em', 'Created', 'Создан');
add('pendingMembers.colAction', 'Ação', 'Action', 'Действие');
add('pendingMembers.accept', 'Aceitar', 'Accept', 'Принять');
add(
  'pendingMembers.searchPh',
  'Buscar por nickname, email ou id...',
  'Search by nickname, email or id...',
  'Поиск по нику, email или id...',
);
add('pendingMembers.loadError', 'Falha ao carregar pendentes', 'Failed to load pending', 'Не удалось загрузить ожидающих');

add('permissions.colId', 'ID', 'ID', 'ID');
add('permissions.colNickname', 'Nickname', 'Nickname', 'Ник');
add('permissions.colEmail', 'Email', 'Email', 'Email');
add('permissions.colStatus', 'Status', 'Status', 'Статус');
add('permissions.colCreated', 'Criado', 'Created', 'Создан');
add('permissions.statusAccepted', 'Aceito', 'Accepted', 'Принят');
add('permissions.statusPending', 'Pendente', 'Pending', 'Ожидает');
add('permissions.roleNone', 'Nenhum', 'None', 'Нет');
add('permissions.roleMember', 'Membro', 'Member', 'Участник');
add('permissions.roleModerator', 'Moderador', 'Moderator', 'Модератор');
add('permissions.roleAdmin', 'Admin', 'Admin', 'Админ');
add('permissions.roleRoot', 'Root', 'Root', 'Root');
add(
  'permissions.searchPh',
  'Buscar por nickname, email ou id...',
  'Search by nickname, email or id...',
  'Поиск по нику, email или id...',
);
add('permissions.loadError', 'Falha ao carregar usuários', 'Failed to load users', 'Не удалось загрузить пользователей');

add('items.deleteConfirm', 'Deletar item #{{id}} ({{name}})?', 'Delete item #{{id}} ({{name}})?', 'Удалить предмет #{{id}} ({{name}})?');

add('eventsClaims.imageTitle', 'Imagem do piloto', 'Pilot image', 'Изображение пилота');
add('eventsClaims.statusPendingShort', 'Pendente', 'Pending', 'В ожидании');

// events public
add('eventsPublic.title', 'Eventos', 'Events', 'События');

// events claims / pending labels - use short
add('eventsClaims.searchPh', 'Buscar por evento, code ou usuário...', 'Search by event, code or user...', 'Поиск по событию, коду или пользователю...');

add('eventsPilot.searchPh', 'Buscar por evento ou usuário...', 'Search by event or user...', 'Поиск по событию или пользователю...');

// donations
add('donations.empty', 'Nenhuma doação', 'No donations', 'Нет пожертвований');

// objectives
add('objectives.formTitle', 'Criar objetivo', 'Create objective', 'Создать цель');
add('objectives.submit', 'Criar objetivo', 'Create objective', 'Создать цель');

// events admin
add('eventsAdmin.formTitle', 'Criar evento', 'Create event', 'Создать событие');
add('eventsAdmin.submit', 'Criar evento', 'Create event', 'Создать событие');

// cancel event dialog
add('cancelEvent.title', 'Cancelar evento', 'Cancel event', 'Отменить событие');
add('cancelEvent.back', 'Voltar', 'Back', 'Назад');

// item modal / items
add('items.createItem', 'Criar item', 'Create item', 'Создать предмет');
add('items.editItem', 'Editar item #{{id}}', 'Edit item #{{id}}', 'Редактировать предмет #{{id}}');
add('items.noneFound', 'Nenhum item encontrado.', 'No items found.', 'Предметы не найдены.');

// auction picker
add('auctionPicker.searchPh', 'Buscar (nome/código)...', 'Search (name/code)...', 'Поиск (имя/код)...');
add('auctionPicker.none', 'Nenhum item encontrado.', 'No items found.', 'Ничего не найдено.');

// image picker
add('imagePicker.catalogPh', 'Buscar no catálogo...', 'Search catalog...', 'Поиск в каталоге...');
add('imagePicker.searchBtn', 'Buscar', 'Search', 'Найти');
add('imagePicker.loading', 'Carregando...', 'Loading...', 'Загрузка...');
add('imagePicker.noImages', 'Nenhuma imagem encontrada.', 'No images found.', 'Изображения не найдены.');

// ui-select
add('uiSelect.searchPh', 'Buscar...', 'Search...', 'Поиск...');
add('uiSelect.noOptions', 'Nenhuma opção.', 'No options.', 'Нет вариантов.');

// shields / casts / accessories toolbars (short)
add('shields.searchPh', 'Buscar por nome, code, cast, effects, valores...', 'Search name, code, cast, effects...', 'Поиск по имени, коду, cast...');
add('casts.searchPh', 'Buscar por nome, code, descrição...', 'Search name, code, description...', 'Поиск по имени, коду, описанию...');

add('shields.none', 'Nenhum shield encontrado.', 'No shields found.', 'Щиты не найдены.');
add('casts.none', 'Nenhum cast encontrado para esse filtro.', 'No casts for this filter.', 'Нет cast для фильтра.');
add('accessories.none', 'Nenhum accessory encontrado.', 'No accessories found.', 'Аксессуары не найдены.');

// event toast (claim)
add('eventToast.pointsWord', 'pontos', 'points', 'очков');
add('eventToast.withPilot', 'com piloto:', 'with pilot:', 'с пилотом:');
add('eventToast.bonus', '(bônus +{{n}})', '(bonus +{{n}})', '(бонус +{{n}})');
add('eventToast.expiresAt', 'expira às', 'expires at', 'истекает в');
add('eventToast.in', 'em', 'in', 'через');
add('eventToast.passwordLabel', 'Senha do evento', 'Event password', 'Пароль события');
add('eventToast.passwordPh', 'Digite a senha', 'Enter password', 'Введите пароль');
add('eventToast.pilotQuestion', 'Você usou piloto?', 'Did you use a pilot?', 'Использовали пилота?');
add('eventToast.pilotPending', 'Esse claim fica pendente de aprovação.', 'This claim will await approval.', 'Claim будет ждать одобрения.');
add('eventToast.imageRequired', 'Imagem (obrigatório)', 'Image (required)', 'Изображение (обязательно)');
add('eventToast.uploadTitle', 'Upload de imagem', 'Image upload', 'Загрузка изображения');
add('eventToast.uploadHint', 'Clique, arraste/solte ou cole (Ctrl+V)', 'Click, drag/drop or paste (Ctrl+V)', 'Клик, перетаскивание или Ctrl+V');
add('eventToast.clickToChange', 'clique para trocar', 'click to change', 'клик — заменить');
add('eventToast.swap', 'Trocar', 'Change', 'Заменить');
add('eventToast.removeFile', 'Remover', 'Remove', 'Убрать');
add('eventToast.needImage', 'Envie uma imagem para continuar.', 'Upload an image to continue.', 'Загрузите изображение.');
add('eventToast.expired', 'Evento expirado.', 'Event expired.', 'Событие истекло.');
add('eventToast.claim', 'Reivindicar', 'Claim', 'Забрать');

// Toasts (TS)
add('toast.nicknameRequired', 'Informe um nickname.', 'Enter a nickname.', 'Укажите никнейм.');
add('toast.nicknameWelcome', 'Nickname confirmado. Bem-vindo!', 'Nickname confirmed. Welcome!', 'Никнейм подтверждён. Добро пожаловать!');
add('toast.nicknameSaveFail', 'Falha ao salvar nickname', 'Failed to save nickname', 'Не удалось сохранить никнейм');
add('toast.objectiveFields', 'Corrija os campos.', 'Fix the fields.', 'Исправьте поля.');
add('toast.objectiveUpdated', 'Objetivo atualizado!', 'Objective updated!', 'Цель обновлена!');
add('toast.objectiveUpdateFail', 'Não foi possível atualizar.', 'Could not update.', 'Не удалось обновить.');
add('toast.nicknameChanged', 'Nickname alterado com sucesso.', 'Nickname changed successfully.', 'Никнейм изменён.');
add('toast.nicknameChangeFail', 'Falha ao alterar nickname', 'Failed to change nickname', 'Не удалось сменить никнейм');
add('toast.objectivesLoadFail', 'Falha ao carregar objetivos.', 'Failed to load objectives.', 'Не удалось загрузить цели.');
add('toast.fillRequired', 'Preencha os campos obrigatórios.', 'Fill in required fields.', 'Заполните обязательные поля.');
add('toast.invalidDuration', 'Duração inválida.', 'Invalid duration.', 'Неверная длительность.');
add('toast.altPointsMin', 'Informe quantos pontos vale levar alt (mínimo 1).', 'Enter alt points (min 1).', 'Укажите очки за alt (мин. 1).');
add('toast.eventCreated', 'Evento criado com sucesso!', 'Event created successfully!', 'Событие создано!');
add('toast.eventCreateFail', 'Não foi possível criar o evento.', 'Could not create the event.', 'Не удалось создать событие.');
add('toast.selectAmount', 'Selecione um valor.', 'Select an amount.', 'Выберите сумму.');
add('toast.donationSent', 'Doação enviada! Aguarde aprovação de um admin.', 'Donation sent! Await admin approval.', 'Пожертвование отправлено! Ждите одобрения.');
add('toast.donationSendFail', 'Não foi possível enviar a doação.', 'Could not send the donation.', 'Не удалось отправить пожертвование.');
add('toast.objectiveCreated', 'Objetivo criado com sucesso!', 'Objective created successfully!', 'Цель создана!');
add('toast.objectiveCreateFail', 'Não foi possível criar o objetivo.', 'Could not create objective.', 'Не удалось создать цель.');
add('toast.objectiveDeleted', 'Objetivo deletado!', 'Objective deleted!', 'Цель удалена!');
add('toast.objectiveDeleteFail', 'Objetivo não pode ser excluido, em breve poderá!!!.', 'Objective cannot be deleted yet.', 'Цель пока нельзя удалить.');
add('toast.titleRequired', 'Título é obrigatório', 'Title is required', 'Нужен заголовок');
add('toast.pointsInvalid', 'Pontos inválidos', 'Invalid points', 'Неверные очки');
add(
  'toast.participationAdded',
  'Participação adicionada (+{{pts}} pontos).',
  'Participation added (+{{pts}} points).',
  'Участие добавлено (+{{pts}} очков).',
);
add('toast.participationFail', 'Falha ao adicionar participação', 'Failed to add participation', 'Не удалось добавить участие');
add('toast.pointsRemoveQty', 'Informe quantos pontos remover', 'Enter points to remove', 'Укажите, сколько очков снять');
add('toast.pointsRemoved', '{{n}} pontos removidos.', '{{n}} points removed.', 'Снято {{n}} очков.');
add('toast.pointsRemoveFail', 'Falha ao remover pontos', 'Failed to remove points', 'Не удалось снять очки');
add('toast.claimAlreadyCancelled', 'Esse claim já estava cancelado.', 'This claim was already cancelled.', 'Этот claim уже был отменён.');
add('toast.claimCancelled', 'Claim cancelado (-{{pts}} pts).', 'Claim cancelled (-{{pts}} pts).', 'Claim отменён (-{{pts}} очк.).');
add('toast.pendingLoadFail', 'Falha ao carregar pendentes', 'Failed to load pending', 'Не удалось загрузить ожидающие');
add('toast.approvedWithPts', 'Aprovado ✅ (+{{pts}} pts)', 'Approved ✅ (+{{pts}} pts)', 'Одобрено ✅ (+{{pts}} очк.)');
add('toast.approved', 'Aprovado ✅', 'Approved ✅', 'Одобрено ✅');
add('toast.approveFail', 'Falha ao aprovar', 'Failed to approve', 'Не удалось одобрить');
add('toast.rejected', 'Rejeitado ✅', 'Rejected ✅', 'Отклонено ✅');
add('toast.rejectFail', 'Falha ao rejeitar', 'Failed to reject', 'Не удалось отклонить');
add('toast.claimsLoadFail', 'Falha ao carregar claims', 'Failed to load claims', 'Не удалось загрузить claims');
add('toast.donationsLoadFail', 'Falha ao carregar doações', 'Failed to load donations', 'Не удалось загрузить пожертвования');
add('toast.definitionsLoadFail', 'Falha ao carregar definições.', 'Failed to load definitions.', 'Не удалось загрузить определения.');
add('toast.usersLoadFail', 'Falha ao carregar usuários.', 'Failed to load users.', 'Не удалось загрузить пользователей.');
add('toast.reasonTooLong', 'O motivo está muito longo.', 'Reason is too long.', 'Причина слишком длинная.');
add('toast.eventCancelledOk', 'Evento cancelado com sucesso!', 'Event cancelled successfully!', 'Событие отменено!');
add('toast.eventCancelFail', 'Não foi possível cancelar o evento.', 'Could not cancel the event.', 'Не удалось отменить событие.');
add(
  'toast.permissionUpdated',
  'Permissão de {{nick}}: {{prev}} → {{next}}',
  'Permission for {{nick}}: {{prev}} → {{next}}',
  'Права {{nick}}: {{prev}} → {{next}}',
);
add('toast.permissionFail', 'Falha ao atualizar permissão', 'Failed to update permission', 'Не удалось обновить права');
add('toast.userAccepted', 'Usuário {{nick}} aceito!', 'User {{nick}} accepted!', 'Пользователь {{nick}} принят!');
add('toast.acceptFail', 'Falha ao aceitar usuário', 'Failed to accept user', 'Не удалось принять пользователя');
add('toast.sentApproval', 'Enviado para aprovação ✅', 'Sent for approval ✅', 'Отправлено на одобрение ✅');
add('toast.pointsReceived', '+{{n}} pontos recebidos!', '+{{n}} points received!', '+{{n}} очков получено!');
add('toast.claimPasswordFail', 'Falha ao validar senha', 'Failed to validate password', 'Ошибка проверки пароля');

// roles for permissions toast - keep as data from API, only template in toast.permissionUpdated

// events public
add(
  'eventsPublic.subtitle',
  'Veja eventos ativos e faça claim com a senha. Finalizados e cancelados também ficam listados.',
  'View active events and claim with the password. Finished and cancelled are listed too.',
  'Активные события и claim по паролю. Завершённые и отменённые тоже в списке.',
);
add('eventsPublic.loadError', 'Falha ao carregar eventos', 'Failed to load events', 'Не удалось загрузить события');
add('eventsPublic.colStatus', 'Status', 'Status', 'Статус');
add('eventsPublic.colEvent', 'Evento', 'Event', 'Событие');
add('eventsPublic.colPoints', 'Pontos', 'Points', 'Очки');
add('eventsPublic.colExpires', 'Expira', 'Expires', 'Истекает');
add('eventsPublic.colState', 'Estado', 'State', 'Состояние');
add('eventsPublic.colActions', 'Ações', 'Actions', 'Действия');
add('eventsPublic.statusRow.cancelled', 'Cancelado', 'Cancelled', 'Отменено');
add('eventsPublic.statusRow.active', 'Ativo', 'Active', 'Активно');
add('eventsPublic.statusRow.ended', 'Finalizado', 'Finished', 'Завершено');
add('eventsPublic.stateRow.claimed', 'Reivindicado', 'Claimed', 'Забрано');
add('eventsPublic.stateRow.available', 'Disponível', 'Available', 'Доступно');
add('eventsPublic.stateRow.unavailable', 'Indisponível', 'Unavailable', 'Недоступно');
add('eventsPublic.stateRow.closed', 'Encerrado', 'Closed', 'Закрыто');
add('eventsPublic.reasonLabel', 'Motivo:', 'Reason:', 'Причина:');
add('eventsPublic.claim', 'Reivindicar', 'Claim', 'Забрать');
add('spinner.loading', 'Carregando...', 'Loading...', 'Загрузка...');

// donations page
add('donations.title', 'Doações', 'Donations', 'Пожертвования');
add(
  'donations.subtitle',
  'Doações de disena • tabela visível a todos • aprovar/reprovar apenas admin e root',
  'Disena donations • table visible to everyone • approve/reject admin and root only',
  'Пожертвования disena • таблица для всех • одобрение/отклонение только admin/root',
);
add('donations.filterAll', 'Todos', 'All', 'Все');
add('donations.filterPending', 'Pendentes', 'Pending', 'В ожидании');
add('donations.filterApproved', 'Aprovados', 'Approved', 'Одобрено');
add('donations.filterRejected', 'Rejeitados', 'Rejected', 'Отклонено');
add('donations.total', 'Total', 'Total', 'Всего');
add('donations.metaTotalLabel', 'Total:', 'Total:', 'Всего:');
add('donations.emptySub', 'As doações enviadas pelos usuários aparecerão aqui.', 'User donations will appear here.', 'Пожертвования пользователей появятся здесь.');
add('donations.colId', 'Id', 'ID', 'ID');
add('donations.colUser', 'Usuário', 'User', 'Пользователь');
add('donations.colAmount', 'Valor', 'Amount', 'Сумма');
add('donations.colPoints', 'Pontos', 'Points', 'Очки');
add('donations.colStatus', 'Status', 'Status', 'Статус');
add('donations.colSentAt', 'Enviado em', 'Sent at', 'Отправлено');
add('donations.colReviewedAt', 'Revisado em', 'Reviewed at', 'Проверено');
add('donations.colActions', 'Ações', 'Actions', 'Действия');
add('donations.amountSuffix', 'kk', 'kk', 'kk');
add('donations.pointsFmt', '+{{n}} pts', '+{{n}} pts', '+{{n}} очк.');
add('donations.status.pending', 'Pendente', 'Pending', 'В ожидании');
add('donations.status.approved', 'Aprovado', 'Approved', 'Одобрено');
add('donations.status.rejected', 'Rejeitado', 'Rejected', 'Отклонено');
add('donations.approve', 'Aprovar', 'Approve', 'Одобрить');
add('donations.reject', 'Rejeitar', 'Reject', 'Отклонить');

// auctions public
add('auctions.title', 'Leilões', 'Auctions', 'Аукционы');
add(
  'auctions.subtitle',
  'Participe dos leilões usando seus pontos de guild. Tempo real • atualiza automaticamente.',
  'Join auctions using your guild points. Real-time • auto-updates.',
  'Участвуйте в аукционах за очки гильдии. В реальном времени • автообновление.',
);
add('auctions.yourPoints', 'Seus pontos', 'Your points', 'Ваши очки');
add('auctions.pointsTotal', 'Totais', 'Total', 'Всего');
add('auctions.pointsReserved', 'Travados', 'Locked', 'Заблокировано');
add('auctions.pointsAvailable', 'Disponíveis', 'Available', 'Доступно');
add('auctions.close', 'Fechar', 'Close', 'Закрыть');
add('auctions.noImg', 'no img', 'no img', 'нет фото');
add('auctions.noEffects', 'Sem efeitos', 'No effects', 'Без эффектов');
add('auctions.statusActive', 'Ativo', 'Active', 'Активен');
add('auctions.statusTieCountdown', 'Contagem para desempate', 'Tie countdown', 'Отсчёт к ничьей');
add('auctions.statusTieRolling', 'Desempate', 'Tie-break', 'Перетягивание');
add('auctions.statusFinalizing', 'Finalizando', 'Finalizing', 'Завершение');
add('auctions.statusCanceled', 'Cancelado', 'Cancelled', 'Отменён');
add('auctions.statusFinished', 'Finalizado', 'Finished', 'Завершён');
add('auctions.tieBetween', 'Empate entre {{n}} jogadores', 'Tie between {{n}} players', 'Ничья между {{n}} игроками');
add('auctions.timeStart', 'Início', 'Start', 'Начало');
add('auctions.timeEnd', 'Fim', 'End', 'Конец');
add('auctions.lastBid', 'Último lance:', 'Last bid:', 'Последняя ставка:');
add('auctions.by', 'por', 'by', 'от');
add('auctions.yourBidLocked', 'Seu lance travado aqui:', 'Your locked bid:', 'Ваша заблокированная ставка:');
add('auctions.yourPointsLabel', 'Seus pontos:', 'Your points:', 'Ваши очки:');
add('auctions.lockedShort', 'travados', 'locked', 'заблок.');
add('auctions.topBidderWait', 'Você é o último lance. Aguarde alguém cobrir seu lance para poder ofertar novamente.', 'You have the top bid. Wait for someone to outbid you before bidding again.', 'У вас последняя ставка. Дождитесь перебива, чтобы снова торговаться.');
add('auctions.bidPlaceholder', 'Seu lance', 'Your bid', 'Ваша ставка');
add('auctions.placeBid', 'Dar lance', 'Place bid', 'Сделать ставку');
add('auctions.allInTitle', 'Tenta ALL-IN (útil para empatar)', 'Try ALL-IN (useful to tie)', 'ALL-IN (для ничьей)');
add('auctions.tieBreakTitle', '⏳ Desempate', '⏳ Tie-break', '⏳ Перетягивание');
add('auctions.tieBetweenLabel', 'Empate entre:', 'Tie between:', 'Ничья между:');
add('auctions.rouletteIn', 'Roleta em {{s}}s', 'Wheel in {{s}}s', 'Колесо через {{s}}с');
add('auctions.rouletteHint', 'Assim que a roleta iniciar, ela vai girar e só depois anunciar o vencedor.', 'When the wheel starts it spins before announcing the winner.', 'Колесо крутится, затем объявляют победителя.');
add('auctions.bidsTitle', 'Lances', 'Bids', 'Ставки');
add('auctions.live', 'Ao vivo', 'Live', 'Онлайн');
add('auctions.bidAction', 'deu lance de', 'bid', 'ставка');
add('auctions.reactToggle', 'Reagir/Remover', 'React/Remove', 'Реакция/убрать');
add('auctions.bytes', 'bytes', 'bytes', 'байт');
add('auctions.colStatus', 'Status', 'Status', 'Статус');
add('auctions.colItem', 'Item', 'Item', 'Предмет');
add('auctions.colTime', 'Tempo', 'Time', 'Время');
add('auctions.colLeading', 'Vencendo', 'Leading', 'Лидирует');
add('auctions.colStart', 'Início', 'Start', 'Начало');
add('auctions.colEnd', 'Fim', 'End', 'Конец');
add('auctions.noBids', 'Nenhum lance', 'No bids', 'Нет ставок');
add(
  'auctions.leadingBid',
  '({{nick}}) - Pts: {{amt}}',
  '({{nick}}) - Pts: {{amt}}',
  '({{nick}}) — очков: {{amt}}',
);
add('auctions.loadError', 'Falha ao carregar leilões', 'Failed to load auctions', 'Не удалось загрузить аукционы');
add('auctions.modalCaptionEnds', 'Termina em:', 'Ends in:', 'Заканчивается через:');
add('auctions.modalCaptionCanceled', 'Cancelado:', 'Cancelled:', 'Отменено:');
add('auctions.modalCaptionFinished', 'Finalizado:', 'Finished:', 'Завершено:');
add('auctions.modalCaptionStarts', 'Começa em:', 'Starts in:', 'Начинается через:');
add('auctions.chatUploadFail', 'Erro ao enviar arquivo', 'Failed to upload file', 'Ошибка загрузки файла');
add('auctions.chatSendFail', 'Erro no chat', 'Chat error', 'Ошибка чата');
add(
  'auctions.promptReact',
  'Digite um emoji (😂) OU cole a URL de uma figurinha/imagem/gif:',
  'Enter an emoji (😂) OR paste sticker/image/gif URL:',
  'Введите эмодзи (😂) или вставьте URL стикера/картинки/gif:',
);
add('auctions.bidVerb', 'deu lance de', 'placed a bid of', 'ставка');

// objectives page extra
add('objectives.desc', 'Descrição', 'Description', 'Описание');
add('objectives.points', 'Pontos', 'Points', 'Очки');
add('objectives.titlePh', 'Ex.: Concluir meta diária', 'E.g. Complete daily goal', 'Напр. выполнить дневную цель');
add('objectives.errTitle', 'Obrigatório (2–80 chars).', 'Required (2–80 chars).', 'Обязательно (2–80 симв.).');
add('objectives.errPoints', 'Informe um número válido.', 'Enter a valid number.', 'Укажите число.');
add('objectives.errCategory', 'Selecione uma categoria.', 'Select a category.', 'Выберите категорию.');
add('objectives.category', 'Categoria', 'Category', 'Категория');
add('objectives.activeLabel', 'Ativo', 'Active', 'Активен');
add('objectives.col.code', 'Código', 'Code', 'Код');
add('objectives.col.title', 'Título', 'Title', 'Заголовок');
add('objectives.col.category', 'Categoria', 'Category', 'Категория');
add('objectives.col.active', 'Ativo', 'Active', 'Активен');
add('objectives.col.createdAt', 'Criado em', 'Created', 'Создан');
add('objectives.deleteTitle', 'Deletar objetivo', 'Delete objective', 'Удалить цель');
add(
  'objectives.deleteMessage',
  'Tem certeza que deseja deletar "{{title}}" ({{code}})?',
  'Are you sure you want to delete "{{title}}" ({{code}})?',
  'Удалить «{{title}}» ({{code}})?',
);

writeFileSync(join(outDir, 'pt-BR.json'), JSON.stringify(dict.ptBR, null, 2), 'utf8');
writeFileSync(join(outDir, 'en.json'), JSON.stringify(dict.en, null, 2), 'utf8');
writeFileSync(join(outDir, 'ru.json'), JSON.stringify(dict.ru, null, 2), 'utf8');

console.log('Wrote pt-BR.json, en.json, ru.json to', outDir);
