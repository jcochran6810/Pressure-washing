-- The old CHECK only allowed {flat, sqft, linear_ft, hour, each}, but the
-- trade-defaults catalog uses sq_ft (underscore form) plus richer units
-- (visit, month, room, cubic_yard, square, fixture, window, panel, load,
-- acre, each). Without those, "Load trade defaults" silently fails the
-- CHECK and the action looks broken from the UI. Widen the constraint to
-- match PRICING_UNITS exactly. 'sqft' kept for legacy rows seeded by the
-- handle_new_user trigger.

alter table services drop constraint if exists services_pricing_unit_check;

alter table services
  add constraint services_pricing_unit_check
  check (pricing_unit = any (array[
    'flat','hour','sq_ft','sqft','linear_ft','room','each','visit',
    'month','acre','fixture','window','panel','load','cubic_yard','square'
  ]));
