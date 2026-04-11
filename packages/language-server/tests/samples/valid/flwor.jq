declare function local:f($a, $b as integer) {
    for $x at $pos in (1, 2, 3)
    let $y := $x + $a
    group by $g := $y mod 2
    count $c
    return $g + $c + $b
};