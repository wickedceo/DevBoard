begin;

alter policy "Users can create their own notifications"
  on public.notifications
  to authenticated;

alter policy "Users can delete their own notifications"
  on public.notifications
  to authenticated;

alter policy "Users can update their own notifications"
  on public.notifications
  to authenticated;

alter policy "Users can view their own notifications"
  on public.notifications
  to authenticated;

drop policy if exists devboard_owner_guard_projects
  on public.projects;
drop policy if exists devboard_owner_guard_tasks
  on public.tasks;
drop policy if exists devboard_owner_guard_team_members
  on public.team_members;
drop policy if exists devboard_owner_guard_notifications
  on public.notifications;
drop policy if exists devboard_owner_guard_user_settings
  on public.user_settings;

create policy devboard_owner_guard_projects
  on public.projects
  as restrictive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy devboard_owner_guard_tasks
  on public.tasks
  as restrictive
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and (
      project_id is null
      or exists (
        select 1
        from public.projects as project
        where project.id = tasks.project_id
          and project.user_id = (select auth.uid())
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      project_id is null
      or exists (
        select 1
        from public.projects as project
        where project.id = tasks.project_id
          and project.user_id = (select auth.uid())
      )
    )
  );

create policy devboard_owner_guard_team_members
  on public.team_members
  as restrictive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy devboard_owner_guard_notifications
  on public.notifications
  as restrictive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy devboard_owner_guard_user_settings
  on public.user_settings
  as restrictive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
