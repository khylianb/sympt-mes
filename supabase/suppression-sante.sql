-- ============================================================
-- Sympt'mes — suppression définitive des anciennes données de santé
-- À lancer UNE fois dans Supabase : SQL Editor → New query → Run,
-- après avoir ouvert la nouvelle version de l'appli sur chaque téléphone
-- (elle garde les anciennes journées remplies comme jours de repas de l'axolotl).
-- Irréversible : symptômes, repas, notes et symptômes ajoutés sont effacés.
-- ============================================================

drop table if exists public.symptom_logs;
drop table if exists public.meals;
drop table if exists public.day_notes;
drop table if exists public.custom_symptoms;

-- Ancien en-tête du PDF (nom, date de naissance)
delete from public.app_meta where key = 'profile';
