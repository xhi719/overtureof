import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();
const locales = ['ko', 'en', 'zh-CN', 'zh-TW'] as const;
type Texts = Record<string, string>;
type QuestionSeed = { key: string; type: string; required: boolean; text: Texts; options?: string[] };
type QuestionnaireSeed = { version: string; options: Record<string, Texts>; questions: QuestionSeed[] };

async function seedQuestionnaire() {
  const file = path.join(process.cwd(), 'content', 'questionnaire.json');
  const input = JSON.parse(await readFile(file, 'utf8')) as QuestionnaireSeed;
  if (!input.version || input.questions.length !== 15 || new Set(input.questions.map(q => q.key)).size !== 15) throw new Error('Invalid questionnaire structure');
  for (const question of input.questions) {
    if (!['single', 'multiple', 'range'].includes(question.type)) throw new Error(`Invalid question type: ${question.key}`);
    if (question.type !== 'range' && !question.options?.length) throw new Error(`Missing options: ${question.key}`);
    for (const locale of locales) {
      if (!question.text[locale]?.trim()) throw new Error(`Missing question translation: ${question.key}/${locale}`);
      for (const option of question.options ?? []) if (!input.options[option]?.[locale]?.trim()) throw new Error(`Missing option translation: ${option}/${locale}`);
    }
  }
  await prisma.$transaction(async tx => {
  const questionnaire = await tx.questionnaire.upsert({
    where: { id: 'general-v1' },
    create: { id: 'general-v1', version: input.version, status: 'published' },
    update: {},
  });
  for (const [order, item] of input.questions.entries()) {
    const question = await tx.question.upsert({
      where: { questionnaireId_key: { questionnaireId: questionnaire.id, key: item.key } },
      create: { questionnaireId: questionnaire.id, key: item.key, type: item.type, order, required: item.required },
      update: {},
    });
    for (const locale of locales) {
      const exists = await tx.questionTranslation.findFirst({ where: { questionId: question.id, optionId: null, locale } });
      if (!exists) await tx.questionTranslation.create({ data: { questionId: question.id, locale, text: item.text[locale] } });
    }
    for (const [optionOrder, value] of (item.options ?? []).entries()) {
      const option = await tx.questionOption.upsert({
        where: { questionId_value: { questionId: question.id, value } },
        create: { questionId: question.id, value, order: optionOrder },
        update: {},
      });
      for (const locale of locales) {
        const exists = await tx.questionTranslation.findFirst({ where: { questionId: question.id, optionId: option.id, locale } });
        if (!exists) await tx.questionTranslation.create({ data: { questionId: question.id, optionId: option.id, locale, text: input.options[value][locale] } });
      }
    }
  }
  }, { timeout: 60000 });
}

async function main() {
  for (const locale of locales) {
    const file = path.join(process.cwd(), 'content', `${locale}.json`);
    const values: Record<string, unknown> = JSON.parse(await readFile(file, 'utf8'));
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid content: ${locale}/${key}`);
      const contentKey = await prisma.contentKey.upsert({ where: { key }, create: { key }, update: {} });
      // Existing translations may have been edited by an administrator; do not overwrite them.
      await prisma.contentLocalization.upsert({
        where: { contentKeyId_locale: { contentKeyId: contentKey.id, locale } },
        create: { contentKeyId: contentKey.id, locale, value },
        update: {},
      });
    }
  }
  await seedQuestionnaire();
}

main().finally(() => prisma.$disconnect());
