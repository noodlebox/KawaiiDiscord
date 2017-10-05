import _ from "lodash";

// This is super hackish, and will likely break as Discord's internal API changes
// Anything using this or what it returns should be prepared to catch some exceptions
const getInternalInstance = e => e[Object.keys(e).find(k => k.startsWith("__reactInternalInstance"))];

export function getOwnerInstance(e, {include, exclude=["Popout", "Tooltip", "Scroller", "BackgroundFlash"]} = {}) {
    if (e === undefined) {
        return undefined;
    }

    // Set up filter; if no include filter is given, match all except those in exclude
    const excluding = include === undefined;
    const filter = excluding ? exclude : include;

    // Get displayName of the React class associated with this element
    function getDisplayName(owner) {
        return owner.type.displayName || owner.type || null;
    }
    // Check class name against filters
    function classFilter(owner) {
        const name = getDisplayName(owner);
        return (name !== null && !!(filter.includes(name) ^ excluding));
    }

    // Walk up the hierarchy until a proper React object is found
    for (let prev, curr=getInternalInstance(e); !_.isNil(curr); prev=curr, curr=curr["return"]) {
        // Get a React object if one corresponds to this DOM element
        // e.g. .user-popout -> UserPopout, ...
        if (classFilter(curr)) {
            return curr;
        }
    }

    return null;
}
