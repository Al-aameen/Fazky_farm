-- ==============================================================================
-- MIGRATION 001: Feed Production Milling Deductions Trigger & Schema Fix
-- Target Table: feed_production, feed_inventory, feed_inventory_log
-- ==============================================================================

-- Step 1: Ensure numeric precision on feed_production columns so decimal inputs (e.g. 7.5 bags) are allowed
ALTER TABLE IF EXISTS public.feed_production ALTER COLUMN wheat_offal_bags TYPE NUMERIC;
ALTER TABLE IF EXISTS public.feed_production ALTER COLUMN concentrate_bags TYPE NUMERIC;
ALTER TABLE IF EXISTS public.feed_production ALTER COLUMN bags_produced TYPE NUMERIC;

-- Step 2: Ensure item_type column exists on feed_inventory
ALTER TABLE IF EXISTS public.feed_inventory ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'raw_material' CHECK (item_type IN ('raw_material', 'finished_feed'));

-- Step 3: Ensure existing finished feed items are tagged as finished_feed
UPDATE public.feed_inventory
SET item_type = 'finished_feed'
WHERE item_name ILIKE '%Layers%' OR item_name ILIKE '%Grower%' OR item_name ILIKE '%Chick%';

-- Step 4: Create or Replace Feed Milling Deduction Trigger Function
CREATE OR REPLACE FUNCTION public.handle_feed_milling_deduction()
RETURNS TRIGGER AS $$
DECLARE
  v_maize_id UUID;
  v_wheat_id UUID;
  v_conc_id  UUID;
  v_premix_id UUID;
  v_layers_id UUID;
  
  v_d_maize NUMERIC := 0;
  v_d_wheat NUMERIC := 0;
  v_d_conc  NUMERIC := 0;
  v_d_premix NUMERIC := 0;
  v_d_bags   NUMERIC := 0;
  v_eff_date DATE;
  v_tonnes   NUMERIC := 0;
BEGIN
  -- Resolve inventory item UUIDs
  SELECT id INTO v_maize_id FROM public.feed_inventory WHERE item_name ILIKE 'Maize%' OR item_name ILIKE '%Maize%' LIMIT 1;
  SELECT id INTO v_wheat_id FROM public.feed_inventory WHERE item_name ILIKE 'Wheat Offal%' OR item_name ILIKE '%Wheat%' LIMIT 1;
  SELECT id INTO v_conc_id  FROM public.feed_inventory WHERE item_name ILIKE 'Concentrate%' OR item_name ILIKE '%Concentrate%' LIMIT 1;
  SELECT id INTO v_premix_id FROM public.feed_inventory WHERE item_name ILIKE 'Premix%' OR item_name ILIKE '%Premix%' LIMIT 1;
  SELECT id INTO v_layers_id FROM public.feed_inventory WHERE (item_type = 'finished_feed' AND item_name ILIKE '%Layers%') OR item_name ILIKE '%Layers%' LIMIT 1;
  
  -- Fallback for finished feed if Layers not found
  IF v_layers_id IS NULL THEN
    SELECT id INTO v_layers_id FROM public.feed_inventory WHERE item_type = 'finished_feed' LIMIT 1;
  END IF;

  -- ── CASE 1: INSERT ──────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_eff_date := NEW.date;
    v_d_maize  := COALESCE(NEW.maize_kg, 0);
    v_d_wheat  := COALESCE(NEW.wheat_offal_bags, 0);
    v_d_conc   := COALESCE(NEW.concentrate_bags, 0);
    v_d_premix := COALESCE(NEW.premix_qty, 0);
    v_d_bags   := COALESCE(NEW.bags_produced, 0);
    v_tonnes   := COALESCE(NEW.feed_produced_tonnes, (v_d_bags * 25.0) / 1000.0);

    -- 1. Deduct Maize
    IF v_d_maize > 0 AND v_maize_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_maize),
          last_updated = NOW()
      WHERE id = v_maize_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_maize_id, v_eff_date, -v_d_maize, 'consumption', 'feed_milling', 'Milled feed batch: used ' || v_d_maize || ' kg maize');
    END IF;

    -- 2. Deduct Wheat Offal
    IF v_d_wheat > 0 AND v_wheat_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_wheat),
          last_updated = NOW()
      WHERE id = v_wheat_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_wheat_id, v_eff_date, -v_d_wheat, 'consumption', 'feed_milling', 'Milled feed batch: used ' || v_d_wheat || ' bags wheat offal');
    END IF;

    -- 3. Deduct Concentrate
    IF v_d_conc > 0 AND v_conc_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_conc),
          last_updated = NOW()
      WHERE id = v_conc_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_conc_id, v_eff_date, -v_d_conc, 'consumption', 'feed_milling', 'Milled feed batch: used ' || v_d_conc || ' bags concentrate');
    END IF;

    -- 4. Deduct Premix
    IF v_d_premix > 0 AND v_premix_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_premix),
          last_updated = NOW()
      WHERE id = v_premix_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_premix_id, v_eff_date, -v_d_premix, 'consumption', 'feed_milling', 'Milled feed batch: used ' || v_d_premix || ' kg premix');
    END IF;

    -- 5. Restock Finished Feed
    IF v_d_bags > 0 AND v_layers_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = current_stock + v_d_bags,
          last_updated = NOW()
      WHERE id = v_layers_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_layers_id, v_eff_date, v_d_bags, 'restock', 'feed_milling', 'Milled ' || v_d_bags || ' bags finished feed (' || v_tonnes || ' tonnes)');
    END IF;

    RETURN NEW;

  -- ── CASE 2: UPDATE (Compute Differences from OLD) ───────────────────────────
  ELSIF TG_OP = 'UPDATE' THEN
    v_eff_date := NEW.date;
    v_d_maize  := COALESCE(NEW.maize_kg, 0) - COALESCE(OLD.maize_kg, 0);
    v_d_wheat  := COALESCE(NEW.wheat_offal_bags, 0) - COALESCE(OLD.wheat_offal_bags, 0);
    v_d_conc   := COALESCE(NEW.concentrate_bags, 0) - COALESCE(OLD.concentrate_bags, 0);
    v_d_premix := COALESCE(NEW.premix_qty, 0) - COALESCE(OLD.premix_qty, 0);
    v_d_bags   := COALESCE(NEW.bags_produced, 0) - COALESCE(OLD.bags_produced, 0);

    -- 1. Maize update
    IF v_d_maize <> 0 AND v_maize_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_maize),
          last_updated = NOW()
      WHERE id = v_maize_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_maize_id, v_eff_date, -v_d_maize, CASE WHEN v_d_maize > 0 THEN 'consumption' ELSE 'restock' END, 'feed_milling', 'Milling batch update adjustment (' || -v_d_maize || ' kg maize)');
    END IF;

    -- 2. Wheat Offal update
    IF v_d_wheat <> 0 AND v_wheat_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_wheat),
          last_updated = NOW()
      WHERE id = v_wheat_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_wheat_id, v_eff_date, -v_d_wheat, CASE WHEN v_d_wheat > 0 THEN 'consumption' ELSE 'restock' END, 'feed_milling', 'Milling batch update adjustment (' || -v_d_wheat || ' bags wheat offal)');
    END IF;

    -- 3. Concentrate update
    IF v_d_conc <> 0 AND v_conc_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_conc),
          last_updated = NOW()
      WHERE id = v_conc_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_conc_id, v_eff_date, -v_d_conc, CASE WHEN v_d_conc > 0 THEN 'consumption' ELSE 'restock' END, 'feed_milling', 'Milling batch update adjustment (' || -v_d_conc || ' bags concentrate)');
    END IF;

    -- 4. Premix update
    IF v_d_premix <> 0 AND v_premix_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_premix),
          last_updated = NOW()
      WHERE id = v_premix_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_premix_id, v_eff_date, -v_d_premix, CASE WHEN v_d_premix > 0 THEN 'consumption' ELSE 'restock' END, 'feed_milling', 'Milling batch update adjustment (' || -v_d_premix || ' kg premix)');
    END IF;

    -- 5. Finished Feed update
    IF v_d_bags <> 0 AND v_layers_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock + v_d_bags),
          last_updated = NOW()
      WHERE id = v_layers_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_layers_id, v_eff_date, v_d_bags, CASE WHEN v_d_bags > 0 THEN 'restock' ELSE 'consumption' END, 'feed_milling', 'Milling batch update adjustment (' || v_d_bags || ' bags finished feed)');
    END IF;

    RETURN NEW;

  -- ── CASE 3: DELETE (Revert Deductions and Restocks) ─────────────────────────
  ELSIF TG_OP = 'DELETE' THEN
    v_eff_date := OLD.date;
    v_d_maize  := COALESCE(OLD.maize_kg, 0);
    v_d_wheat  := COALESCE(OLD.wheat_offal_bags, 0);
    v_d_conc   := COALESCE(OLD.concentrate_bags, 0);
    v_d_premix := COALESCE(OLD.premix_qty, 0);
    v_d_bags   := COALESCE(OLD.bags_produced, 0);

    -- Revert Maize consumption
    IF v_d_maize > 0 AND v_maize_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = current_stock + v_d_maize,
          last_updated = NOW()
      WHERE id = v_maize_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_maize_id, v_eff_date, v_d_maize, 'restock', 'feed_milling', 'Reversal on deletion of milling batch: returned ' || v_d_maize || ' kg maize');
    END IF;

    -- Revert Wheat Offal consumption
    IF v_d_wheat > 0 AND v_wheat_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = current_stock + v_d_wheat,
          last_updated = NOW()
      WHERE id = v_wheat_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_wheat_id, v_eff_date, v_d_wheat, 'restock', 'feed_milling', 'Reversal on deletion of milling batch: returned ' || v_d_wheat || ' bags wheat offal');
    END IF;

    -- Revert Concentrate consumption
    IF v_d_conc > 0 AND v_conc_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = current_stock + v_d_conc,
          last_updated = NOW()
      WHERE id = v_conc_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_conc_id, v_eff_date, v_d_conc, 'restock', 'feed_milling', 'Reversal on deletion of milling batch: returned ' || v_d_conc || ' bags concentrate');
    END IF;

    -- Revert Premix consumption
    IF v_d_premix > 0 AND v_premix_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = current_stock + v_d_premix,
          last_updated = NOW()
      WHERE id = v_premix_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_premix_id, v_eff_date, v_d_premix, 'restock', 'feed_milling', 'Reversal on deletion of milling batch: returned ' || v_d_premix || ' kg premix');
    END IF;

    -- Revert Finished Feed restock
    IF v_d_bags > 0 AND v_layers_id IS NOT NULL THEN
      UPDATE public.feed_inventory
      SET current_stock = GREATEST(0, current_stock - v_d_bags),
          last_updated = NOW()
      WHERE id = v_layers_id;

      INSERT INTO public.feed_inventory_log (inventory_id, date, change_amount, change_type, source, notes)
      VALUES (v_layers_id, v_eff_date, -v_d_bags, 'consumption', 'feed_milling', 'Reversal on deletion of milling batch: deducted ' || v_d_bags || ' bags finished feed');
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Attach Trigger
DROP TRIGGER IF EXISTS trg_feed_milling_deduction ON public.feed_production;
CREATE TRIGGER trg_feed_milling_deduction
AFTER INSERT OR UPDATE OR DELETE ON public.feed_production
FOR EACH ROW
EXECUTE FUNCTION public.handle_feed_milling_deduction();
