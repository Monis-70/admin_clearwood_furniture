import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { BannersScreen } from './banners-screen';
import { FaqsScreen } from './faqs-screen';
import { HelpCentreScreen } from './help-centre-screen';
import { NavigationScreen } from './navigation-screen';
import { PageEditorScreen } from './page-editor-screen';
import { PagesScreen } from './pages-screen';
import { TestimonialsScreen } from './people-and-places-screens';
import { SiteSettingsScreen } from './site-settings-screen';

type Role = 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'ORDER_MANAGER';
const V1 = '/api/v1/admin';

const meta = (n: number) => ({
  page: 1,
  limit: 25,
  total: n,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

function render(ui: React.ReactElement, role: Role, path = '/', search = '') {
  signInAs(account({ role }));
  navigation.reset(path, search);
  return renderWithProviders(<AuthGate>{ui}</AuthGate>);
}

const page = (over: Record<string, unknown> = {}) => ({
  id: 'pg_1',
  slug: 'summer-sale',
  title: 'Summer sale',
  type: 'LANDING',
  status: 'DRAFT',
  isSystem: false,
  noIndex: false,
  publishedAt: null,
  scheduledAt: null,
  expiresAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  template: null,
  excerpt: null,
  heroMediaId: null,
  ogMediaId: null,
  seoTitle: null,
  seoDescription: null,
  seoKeywords: null,
  canonicalUrl: null,
  viewCount: 0,
  version: 3,
  blocks: [] as unknown[],
  ...over,
});

const spacer = {
  id: 'b_1',
  type: 'SPACER',
  position: 0,
  isActive: true,
  deviceVisibility: 'ALL',
  config: { heightPx: 64, showDivider: false },
  rawConfig: null,
  startsAt: null,
  endsAt: null,
  anchorId: null,
  cssClass: null,
};

const blockTypes = [
  {
    type: 'SPACER',
    label: 'Spacer',
    description: 'Vertical breathing room.',
    category: 'LAYOUT',
    maxPerPage: null,
    defaultConfig: { heightPx: 48, showDivider: false },
    mediaFields: [],
    referenceFields: {},
  },
  {
    type: 'HERO_SLIDER',
    label: 'Hero slider',
    description: 'Full-width rotating slides.',
    category: 'HERO',
    maxPerPage: 1,
    defaultConfig: { slides: [], autoplayMs: 6000, showDots: true },
    mediaFields: [],
    referenceFields: {},
  },
];

describe('PagesScreen', () => {
  it('creates a draft page and opens it in the editor', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/pages`,
        guarded(() => ok([page({ isSystem: true, slug: 'home', title: 'Home' })], 200, meta(1))),
      ),
      http.post(
        `${API}/admin/cms/pages`,
        guarded(() => ok(page({ id: 'pg_new' }), 201), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    render(<PagesScreen />, 'CONTENT_MANAGER', '/content/pages');

    const table = await screen.findByRole('table', { name: 'Pages' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Home' }));
    expect(await screen.findByRole('menuitem', { name: 'Duplicate…' })).toBeInTheDocument();
    // A system page cannot be deleted, so the action is not offered.
    expect(screen.queryByRole('menuitem', { name: 'Delete…' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'New page' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Title/), 'Summer sale');
    await user.type(within(dialog).getByLabelText(/URL slug/), 'Summer-Sale');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(callsTo(`${V1}/cms/pages`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/cms/pages`, 'POST')[0]!.body).toEqual({
      title: 'Summer sale',
      slug: 'summer-sale',
      type: 'STANDARD',
    });
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith('/content/pages/edit?id=pg_new'),
    );
  });

  it('explains the missing permission to roles without CMS access', async () => {
    render(<PagesScreen />, 'ORDER_MANAGER', '/content/pages');
    expect(await screen.findByText("You don't have access to pages")).toBeInTheDocument();
    expect(callsTo(`${V1}/cms/pages`, 'GET')).toHaveLength(0);
  });
});

describe('PageEditorScreen', () => {
  it('lists the server blockers when publishing is refused', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/pages/pg_1`,
        guarded(() => ok(page())),
      ),
      http.get(
        `${API}/admin/cms/block-types`,
        guarded(() => ok(blockTypes)),
      ),
      http.post(
        `${API}/admin/cms/pages/pg_1/publish`,
        guarded(
          () =>
            errorBody(422, 'PAGE_NOT_PUBLISHABLE', 'Not publishable', {
              blockers: [{ code: 'NO_BLOCKS' }],
            }),
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<PageEditorScreen />, 'CONTENT_MANAGER', '/content/pages/edit', 'id=pg_1');

    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Publish now' }));

    expect(await screen.findByText('The page cannot be published yet')).toBeInTheDocument();
    expect(screen.getByText('The page has no active blocks.')).toBeInTheDocument();
  });

  it('adds a block from the registry form and shows the saved page', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/pages/pg_1`,
        guarded(() => ok(page())),
      ),
      http.get(
        `${API}/admin/cms/block-types`,
        guarded(() => ok(blockTypes)),
      ),
      http.post(
        `${API}/admin/cms/pages/pg_1/blocks`,
        guarded(() => ok(page({ blocks: [spacer] }), 201), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    const { container } = render(
      <PageEditorScreen />,
      'CONTENT_MANAGER',
      '/content/pages/edit',
      'id=pg_1',
    );

    expect(await screen.findByText('No blocks yet')).toBeInTheDocument();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Add block' }));
    const picker = await screen.findByRole('dialog', { name: 'Add a block' });
    await user.click(within(picker).getByRole('button', { name: /Spacer/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Add spacer' });
    const height = within(dialog).getByLabelText('Height (px)');
    await user.clear(height);
    await user.type(height, '64');
    await user.click(within(dialog).getByRole('button', { name: 'Add block' }));

    await waitFor(() => expect(callsTo(`${V1}/cms/pages/pg_1/blocks`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/cms/pages/pg_1/blocks`, 'POST')[0]!.body).toEqual({
      type: 'SPACER',
      config: { heightPx: 64, showDivider: false },
      isActive: true,
      deviceVisibility: 'ALL',
      startsAt: null,
      endsAt: null,
      anchorId: null,
      cssClass: null,
    });
    const list = await screen.findByRole('list', { name: 'Page blocks' });
    expect(within(list).getByText('Spacer')).toBeInTheDocument();
  });

  it('refuses an invalid block before calling the API', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/pages/pg_1`,
        guarded(() => ok(page({ blocks: [spacer] }))),
      ),
      http.get(
        `${API}/admin/cms/block-types`,
        guarded(() => ok(blockTypes)),
      ),
    );
    const user = userEvent.setup();
    render(<PageEditorScreen />, 'CONTENT_MANAGER', '/content/pages/edit', 'id=pg_1');

    const list = await screen.findByRole('list', { name: 'Page blocks' });
    await user.click(await within(list).findByRole('button', { name: 'Actions for Spacer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit spacer' });
    const height = within(dialog).getByLabelText('Height (px)');
    await user.clear(height);
    await user.type(height, '999');
    await user.click(within(dialog).getByRole('button', { name: 'Save block' }));

    expect(await within(dialog).findByText(/Height \(px\):/)).toBeInTheDocument();
    expect(callsTo(`${V1}/cms/pages/pg_1/blocks/b_1`, 'PATCH')).toHaveLength(0);
  });

  it('saves page settings with the version it was loaded at', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/pages/pg_1`,
        guarded(() => ok(page())),
      ),
      http.patch(
        `${API}/admin/cms/pages/pg_1`,
        guarded(() => ok(page({ title: 'Monsoon sale', version: 4 })), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    render(<PageEditorScreen />, 'CONTENT_MANAGER', '/content/pages/edit', 'id=pg_1&tab=settings');

    const title = await screen.findByLabelText(/^Title/);
    await user.clear(title);
    await user.type(title, 'Monsoon sale');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(callsTo(`${V1}/cms/pages/pg_1`, 'PATCH')).toHaveLength(1));
    expect(callsTo(`${V1}/cms/pages/pg_1`, 'PATCH')[0]!.body).toMatchObject({
      title: 'Monsoon sale',
      slug: 'summer-sale',
      version: 3,
    });
    expect(await screen.findByRole('heading', { name: 'Monsoon sale' })).toBeInTheDocument();
  });
});

describe('FaqsScreen', () => {
  const faq = (id: string, question: string, position: number) => ({
    id,
    faqCategoryId: 'fc_1',
    question,
    answer: 'An answer.',
    visibility: 'GLOBAL',
    position,
    isActive: true,
    targetProductIdsJson: null,
    targetCategoryIdsJson: null,
    helpfulYes: 0,
    helpfulNo: 0,
    version: 1,
  });

  it('reorders questions and saves every position in one request', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/faqs`,
        guarded(() => ok([faq('f1', 'Do you deliver?', 0), faq('f2', 'Is there a warranty?', 1)])),
      ),
      http.get(
        `${API}/admin/cms/faq-categories`,
        guarded(() =>
          ok([
            {
              id: 'fc_1',
              name: 'Delivery',
              slug: 'delivery',
              description: null,
              iconMediaId: null,
              position: 0,
              isActive: true,
              version: 1,
            },
          ]),
        ),
      ),
      http.post(
        `${API}/admin/cms/faqs/reorder`,
        guarded(() => ok(null), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    render(<FaqsScreen />, 'CONTENT_MANAGER', '/content/faqs');

    const list = await screen.findByRole('list', { name: 'Questions' });
    await user.click(within(list).getAllByRole('button', { name: 'Move down' })[0]!);
    expect(screen.getByText('Order changed — not saved yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save order' }));

    await waitFor(() => expect(callsTo(`${V1}/cms/faqs/reorder`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/cms/faqs/reorder`, 'POST')[0]!.body).toEqual({
      order: [
        { id: 'f2', position: 0 },
        { id: 'f1', position: 1 },
      ],
    });
  });
});

describe('HelpCentreScreen', () => {
  const category = {
    id: 'hc_1',
    name: 'Orders',
    slug: 'orders',
    description: null,
    iconMediaId: null,
    parentId: null,
    position: 0,
    isActive: true,
    depth: 0,
    version: 1,
    children: [],
  };
  const article = {
    id: 'ha_1',
    helpCategoryId: 'hc_1',
    slug: 'track-order',
    title: 'Track your order',
    excerpt: null,
    bodyMarkdown: '# Tracking',
    status: 'PUBLISHED',
    position: 0,
    viewCount: 12,
    helpfulYes: 0,
    helpfulNo: 0,
    relatedArticleIdsJson: null,
    seoTitle: null,
    seoDescription: null,
    publishedAt: null,
    version: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('opens the article named in the address and shows a refused category delete', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/help/categories`,
        guarded(() => ok([category])),
      ),
      http.get(
        `${API}/admin/cms/help/articles`,
        guarded(() => ok([article])),
      ),
      http.delete(
        `${API}/admin/cms/help/categories/hc_1`,
        guarded(
          () =>
            errorBody(409, 'HELP_CATEGORY_HAS_ARTICLES', 'Move or delete the articles first', {
              articles: 1,
            }),
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<HelpCentreScreen />, 'CONTENT_MANAGER', '/content/help-centre', 'article=ha_1');

    const dialog = await screen.findByRole('dialog', { name: 'Edit "Track your order"' });
    expect(within(dialog).getByLabelText(/Article/)).toHaveValue('# Tracking');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/content/help-centre', expect.anything()),
    );

    const nav = screen.getByRole('navigation', { name: 'Help categories' });
    await user.click(within(nav).getByRole('button', { name: 'Actions for Orders' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Delete category' }));
    expect(
      await within(confirm).findByText(/Move or delete the articles first/),
    ).toBeInTheDocument();
  });
});

describe('NavigationScreen', () => {
  const item = (over: Record<string, unknown>) => ({
    menuId: 'm1',
    parentId: null,
    type: 'URL',
    position: 0,
    isActive: true,
    isHighlighted: false,
    badgeText: null,
    badgeColor: null,
    url: '/x',
    categoryId: null,
    collectionId: null,
    leadFormKey: null,
    iconMediaId: null,
    menuColumn: null,
    openInNewTab: false,
    ...over,
  });

  it('adds a link item and reports a refused delete of an item with sub-items', async () => {
    server.use(
      http.get(
        `${API}/admin/navigation`,
        guarded(() => ok([{ id: 'm1', key: 'HEADER', name: 'Header', isActive: true }])),
      ),
      http.get(
        `${API}/admin/navigation/HEADER`,
        guarded(() =>
          ok({
            id: 'm1',
            key: 'HEADER',
            name: 'Header',
            isActive: true,
            items: [
              item({ id: 'i1', label: 'Shop', url: '/shop' }),
              item({ id: 'i2', label: 'Sofas', parentId: 'i1', url: '/sofas' }),
            ],
          }),
        ),
      ),
      http.post(
        `${API}/admin/navigation/HEADER/items`,
        guarded(() => ok(item({ id: 'i3', label: 'Sale', url: '/sale' }), 201), { csrf: true }),
      ),
      http.delete(
        `${API}/admin/navigation/items/i1`,
        guarded(
          () => errorBody(409, 'NAVIGATION_HAS_CHILDREN', 'Move or delete the sub-items first'),
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<NavigationScreen />, 'CONTENT_MANAGER', '/content/navigation');

    const top = await screen.findByRole('list', { name: 'Header items' });
    expect(within(top).getByRole('list', { name: 'Inside Shop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Label/), 'Sale');
    await user.selectOptions(within(dialog).getByLabelText('Opens'), 'URL');
    await user.type(within(dialog).getByLabelText(/^Link/), '/sale');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(callsTo(`${V1}/navigation/HEADER/items`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/navigation/HEADER/items`, 'POST')[0]!.body).toMatchObject({
      label: 'Sale',
      type: 'URL',
      url: '/sale',
      parentId: null,
    });
    expect(callsTo(`${V1}/navigation/HEADER/items`, 'POST')[0]!.body).not.toHaveProperty(
      'categoryId',
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(within(top).getAllByRole('button', { name: 'Actions for Shop' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/It has 1 sub-items/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Remove item' }));
    expect(
      await within(confirm).findByText(/Move or delete the sub-items first/),
    ).toBeInTheDocument();
  });
});

describe('SiteSettingsScreen', () => {
  it('sends only the settings that changed, under their API keys', async () => {
    server.use(
      http.get(
        `${API}/admin/content/settings`,
        guarded(() =>
          ok({
            'site.contact_phone': '+91 11111 11111',
            'site.announcement_enabled': true,
            'site.usp_lines': ['Free delivery'],
          }),
        ),
      ),
      http.put(
        `${API}/admin/content/settings`,
        guarded(
          () =>
            ok({
              'site.contact_phone': '+91 22222 22222',
              'site.announcement_enabled': true,
            }),
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<SiteSettingsScreen />, 'SUPER_ADMIN', '/content/site-settings');

    const phone = await screen.findByLabelText('Phone');
    expect(screen.getByText(/cannot be changed here yet/)).toBeInTheDocument();
    await user.clear(phone);
    await user.type(phone, '+91 22222 22222');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(callsTo(`${V1}/content/settings`, 'PUT')).toHaveLength(1));
    expect(callsTo(`${V1}/content/settings`, 'PUT')[0]!.body).toEqual({
      'site.contact_phone': '+91 22222 22222',
    });
  });
});

describe('BannersScreen', () => {
  const banner = {
    id: 'bn_1',
    name: 'Monsoon hero',
    placement: 'HOME_HERO',
    mediaId: null,
    mobileMediaId: null,
    altText: null,
    headline: 'Up to 40% off',
    subheadline: null,
    ctaLabel: null,
    ctaUrl: null,
    ctaStyle: null,
    backgroundHex: null,
    textHex: null,
    isActive: true,
    deviceVisibility: 'MOBILE_ONLY',
    position: 0,
    startsAt: null,
    endsAt: null,
    targetCategoryIdsJson: null,
    targetCollectionIdsJson: null,
    impressionCount: 200,
    clickCount: 10,
    version: 5,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('edits a banner with its version and opens its statistics from the address', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/banners`,
        guarded(() => ok([banner], 200, meta(1))),
      ),
      http.patch(
        `${API}/admin/cms/banners/bn_1`,
        guarded(() => ok({ ...banner, isActive: false, version: 6 }), { csrf: true }),
      ),
      http.get(
        `${API}/admin/cms/banners/bn_1/stats`,
        guarded(() =>
          ok({
            id: 'bn_1',
            name: 'Monsoon hero',
            impressionCount: 200,
            clickCount: 10,
            clickThroughBp: 500,
            daily: [
              { entityType: 'BANNER_IMPRESSION', dayKey: '2026-01-02', viewCount: 120 },
              { entityType: 'BANNER_CLICK', dayKey: '2026-01-02', viewCount: 6 },
            ],
          }),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<BannersScreen />, 'CONTENT_MANAGER', '/content/banners', 'id=bn_1');

    const stats = await screen.findByRole('dialog', { name: /Monsoon hero/ });
    expect(await within(stats).findByText('5%')).toBeInTheDocument();
    expect(within(stats).getByRole('row', { name: '2026-01-02 120 6' })).toBeInTheDocument();
    await user.click(within(stats).getByRole('button', { name: 'Close' }));

    const table = await screen.findByRole('table', { name: 'Banners' });
    expect(within(table).getByText('Phones only')).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'Actions for Monsoon hero' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Monsoon hero' });
    await user.click(within(dialog).getByLabelText('On'));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(callsTo(`${V1}/cms/banners/bn_1`, 'PATCH')).toHaveLength(1));
    expect(callsTo(`${V1}/cms/banners/bn_1`, 'PATCH')[0]!.body).toMatchObject({
      isActive: false,
      version: 5,
      deviceVisibility: 'MOBILE_ONLY',
      targetCategoryIds: null,
    });
  });
});

describe('TestimonialsScreen', () => {
  it('stores a star rating in basis points', async () => {
    server.use(
      http.get(
        `${API}/admin/cms/testimonials`,
        guarded(() => ok([])),
      ),
      http.post(
        `${API}/admin/cms/testimonials`,
        guarded(() => ok({ id: 't1' }, 201), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    render(<TestimonialsScreen />, 'CONTENT_MANAGER', '/content/testimonials');

    await user.click(await screen.findByRole('button', { name: 'New testimonial' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Quote/), 'Lovely sofa.');
    await user.type(within(dialog).getByLabelText(/Customer name/), 'Asha');
    await user.type(within(dialog).getByLabelText(/Rating/), '4.5');
    await user.click(within(dialog).getByRole('button', { name: 'Create testimonial' }));

    await waitFor(() => expect(callsTo(`${V1}/cms/testimonials`, 'POST')).toHaveLength(1));
    expect(callsTo(`${V1}/cms/testimonials`, 'POST')[0]!.body).toMatchObject({
      authorName: 'Asha',
      quote: 'Lovely sofa.',
      ratingBp: 45_000,
      mediaIds: [],
    });
  });
});
