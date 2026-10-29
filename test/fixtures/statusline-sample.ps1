$Themes = @{
# ---- Theme catalogue -------------------------------------------------------
    'deku' = @{
        Label     = 'Deku (Midoriya Izuku)'
        QuirkIcon = '✊'
        Quirk     = Ansi256 46    # One For All green
        Agency    = Ansi 97
        Cooldown  = Ansi 96
        Hero      = 'Deku'
    }
    # ---- Homeroom teacher -----------------------------------------------
    'aizawa' = @{
        Label     = 'Aizawa-sensei (Shota)'
        QuirkIcon = '🧣'
        Quirk     = Ansi256 243   # Erasure — tired all-black everything
        Agency    = Ansi 97
        Cooldown  = Ansi256 60
        Hero      = 'Eraser Head'
    }
    'shinzo' = @{
        Label     = 'Shinzo (Hitoshi)'
        QuirkIcon = '🧠'
        Quirk     = Ansi256 93    # Brainwash — deep violet
        Agency    = Ansi 97
        Cooldown  = Ansi256 60    # muted indigo — underground, night-hidden
        Hero      = 'NightHide'
    }
    # ---- Rest of Class 1-B ----------------------------------------------
    'monoma' = @{
        Label     = 'Monoma (Neito)'
        QuirkIcon = '🪞'
        Quirk     = Ansi256 51    # Copy — mirror cyan
        Agency    = Ansi 97
        Cooldown  = Ansi256 87
        Hero      = 'Phantom Thief'
    }
    # ---- U.A.'s "Big 3" --------------------------------------------------
    'mirio' = @{
        Label     = 'Togata (Mirio)'
        QuirkIcon = '👻'
        Quirk     = Ansi256 220   # Permeation — gold hero suit
        Agency    = Ansi 97
        Cooldown  = Ansi256 226
        Hero      = 'Lemillion'
    }
    # ---- League of Villains (Agency text in red — no hero agency to run) ---
    'dabi' = @{
        Label     = 'Dabi (Todoroki Touya)'
        QuirkIcon = '🔥'
        Quirk     = Ansi256 33    # Cremation — cold blue flame
        Agency    = Ansi 91
        Cooldown  = Ansi256 27
        Hero      = 'Dabi'
        Villain   = $true
    }
}
