
-- Unique constraint: same flat number + wing in same society
CREATE UNIQUE INDEX IF NOT EXISTS flats_society_wing_number_unique 
ON public.flats (society_id, COALESCE(wing, ''), flat_number);

-- RLS for family_members: allow flat_owner to manage their own family members  
CREATE POLICY "Flat owners can manage own family members"
ON public.family_members
FOR ALL
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
  )
)
WITH CHECK (
  member_id IN (
    SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
  )
);

-- Tenants RLS: allow flat_owner to manage tenants on their own flats
CREATE POLICY "Flat owners can manage tenants on own flats"
ON public.tenants
FOR ALL
TO authenticated
USING (
  flat_id IN (
    SELECT m.flat_id FROM public.members m WHERE m.user_id = auth.uid() AND m.flat_id IS NOT NULL
  )
)
WITH CHECK (
  flat_id IN (
    SELECT m.flat_id FROM public.members m WHERE m.user_id = auth.uid() AND m.flat_id IS NOT NULL
  )
);

-- Tenant period history: allow flat owners to view/insert for their own tenants
CREATE POLICY "Flat owners can manage own tenant history"
ON public.tenant_period_history
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT t.id FROM public.tenants t 
    WHERE t.flat_id IN (SELECT m.flat_id FROM public.members m WHERE m.user_id = auth.uid())
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT t.id FROM public.tenants t 
    WHERE t.flat_id IN (SELECT m.flat_id FROM public.members m WHERE m.user_id = auth.uid())
  )
);

-- Documents RLS: allow flat owners to manage their own documents
CREATE POLICY "Flat owners can manage own documents"
ON public.documents
FOR ALL
TO authenticated
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());
