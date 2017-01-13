import $ from "jquery";

// Helper function for finding all elements matching selector affected by a mutation
export function mutationFind(mutation, selector) {
    var target = $(mutation.target);
    var addedNodes = $(mutation.addedNodes);
    var mutated = target.add(addedNodes).filter(selector);
    var descendants = addedNodes.find(selector);
    var ancestors = target.parents(selector);
    return mutated.add(descendants).add(ancestors);
}

// Helper function for finding all elements matching selector removed by a mutation
export function mutationFindRemoved(mutation, selector) {
    var removedNodes = $(mutation.removedNodes);
    var mutated = removedNodes.filter(selector);
    var descendants = removedNodes.find(selector);
    return mutated.add(descendants);
}
