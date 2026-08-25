import { NotificationChannel, NotificationType } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { NotificationTemplateService } from './notification-template.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationTemplate } from '@prisma/client';

const template = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'welcome',
  channel: NotificationChannel.IN_APP,
  type: NotificationType.WELCOME,
  subject: 'Hello {{ name }}',
  body: 'Welcome to {{ app }}.',
  locale: 'en',
  variables: {},
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as NotificationTemplate;

describe('NotificationTemplateService', () => {
  let prisma: {
    notificationTemplate: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: NotificationTemplateService;

  beforeEach(() => {
    prisma = {
      notificationTemplate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new NotificationTemplateService(prisma as unknown as PrismaService);
  });

  it('renders subject and body variables', () => {
    const rendered = service.renderTemplate(template, { name: 'Ada', app: 'DrippleX' });

    expect(rendered).toEqual({
      subject: 'Hello Ada',
      body: 'Welcome to DrippleX.',
    });
  });

  it('renders missing variables as empty strings', () => {
    const rendered = service.renderTemplate(template, { name: 'Ada' });

    expect(rendered.body).toBe('Welcome to .');
  });

  it('escapes HTML special characters in rendered variables', () => {
    const rendered = service.renderTemplate(
      {
        ...template,
        subject: 'Hello {{ name }}',
        body: 'Message: {{ message }}',
      },
      {
        name: `Ada "Admin"`,
        message: `<script>alert('xss') & more</script>`,
      },
    );

    expect(rendered).toEqual({
      subject: 'Hello Ada &quot;Admin&quot;',
      body: 'Message: &lt;script&gt;alert(&#39;xss&#39;) &amp; more&lt;/script&gt;',
    });
  });

  it('loads an active template before rendering', async () => {
    prisma.notificationTemplate.findFirst.mockResolvedValue(template);

    await expect(service.render('welcome', { name: 'Ada', app: 'DrippleX' })).resolves.toEqual({
      subject: 'Hello Ada',
      body: 'Welcome to DrippleX.',
    });
    expect(prisma.notificationTemplate.findFirst).toHaveBeenCalledWith({
      where: { code: 'welcome', active: true, deletedAt: null },
    });
  });

  it('throws when rendering a missing template', async () => {
    prisma.notificationTemplate.findFirst.mockResolvedValue(null);

    await expect(service.render('missing', {})).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('creates templates with defaults', async () => {
    prisma.notificationTemplate.create.mockResolvedValue(template);

    await service.create({
      code: 'welcome',
      channel: NotificationChannel.IN_APP,
      type: NotificationType.WELCOME,
      body: 'Welcome',
    });

    expect(prisma.notificationTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'welcome',
        locale: 'en',
        active: true,
        subject: null,
        variables: {},
      }),
    });
  });

  it('soft deletes templates', async () => {
    prisma.notificationTemplate.update.mockResolvedValue(template);

    await service.delete('welcome');

    expect(prisma.notificationTemplate.update).toHaveBeenCalledWith({
      where: { code: 'welcome' },
      data: { active: false, deletedAt: expect.any(Date) },
    });
  });
});
