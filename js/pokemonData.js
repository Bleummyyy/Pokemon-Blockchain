async function getPokemonNFTData(pokemonIdOrName) {
  try {
    // 1. Get main Pokémon data
    const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonIdOrName}`);
    if (!pokeRes.ok) throw new Error("Pokémon not found");
    const poke = await pokeRes.json();

    // 2. Get species data (flavor text, evolution chain)
    const speciesRes = await fetch(poke.species.url);
    if (!speciesRes.ok) throw new Error("Species data failed");
    const species = await speciesRes.json();

    // 3. Get evolution chain
    let evolvesFrom = null;
    let evolvesTo = [];
    try {
      const evoRes = await fetch(species.evolution_chain.url);
      const evoChain = await evoRes.json();

      // Parse evolution chain (simple 1-step for now)
      const chain = evoChain.chain;
      if (chain.species.name === poke.name && chain.evolves_to.length > 0) {
        evolvesTo = chain.evolves_to.map(e => e.species.name);
      } else {
        let current = chain;
        while (current.evolves_to.length > 0) {
          if (current.evolves_to[0].species.name === poke.name) {
            evolvesFrom = current.species.name;
            evolvesTo = current.evolves_to[0].evolves_to.map(e => e.species.name);
            break;
          }
          current = current.evolves_to[0];
        }
      }
    } catch (e) {
      console.warn("Evolution chain failed:", e);
    }

    // 4. Clean flavor text
    const flavorTextEntry = species.flavor_text_entries.find(
      entry => entry.language.name === 'en'
    );
    const description = flavorTextEntry
      ? flavorTextEntry.flavor_text.replace(/[\n\f]/g, ' ').replace(/ +/g, ' ')
      : `A mysterious Pokémon #${poke.id}.`;

    // 5. Build NFT Metadata (ERC-721 standard)
    const nftMetadata = {
      name: `${poke.name.charAt(0).toUpperCase() + poke.name.slice(1)} #${poke.id}`,
      description: description,
      image: poke.sprites.other['official-artwork'].front_default || poke.sprites.front_default,
      animation_url: poke.sprites.versions['generation-v']['black-white'].animated?.front_default,
      external_url: `https://pokeapi.co/api/v2/pokemon/${poke.id}`,

      attributes: [
        // Stats as traits
        ...poke.stats.map(stat => ({
          trait_type: stat.stat.name.replace('-', ' ').toUpperCase(),
          value: stat.base_stat,
          max_value: 255
        })),
        // Types
        ...poke.types.map((t, i) => ({
          trait_type: i === 0 ? "Primary Type" : "Secondary Type",
          value: t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)
        })),
        // Abilities
        ...poke.abilities.map(a => ({
          trait_type: "Ability",
          value: a.ability.name.charAt(0).toUpperCase() + a.ability.name.slice(1),
          hidden: a.is_hidden
        })),
        // Evolution
        ...(evolvesFrom ? [{ trait_type: "Evolves From", value: evolvesFrom.charAt(0).toUpperCase() + evolvesFrom.slice(1) }] : []),
        ...(evolvesTo.length > 0 ? [{ trait_type: "Evolves To", value: evolvesTo.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ') }] : []),
        // Rarity (example)
        { trait_type: "Generation", value: species.generation.name.split('-')[1].toUpperCase() },
        { trait_type: "Rarity", value: poke.base_experience > 200 ? "Legendary" : poke.base_experience > 150 ? "Rare" : "Common" }
      ],

      // Extra data (not in attributes)
      id: poke.id,
      types: poke.types.map(t => t.type.name),
      abilities: poke.abilities.map(a => a.ability.name),
      moves: poke.moves.slice(0, 4).map(m => m.move.name),
      height: poke.height / 10, // in meters
      weight: poke.weight / 10, // in kg
      base_experience: poke.base_experience
    };

    return nftMetadata;

  } catch (error) {
    console.error("Failed to fetch Pokémon NFT data:", error);
    throw error;
  }
}

getPokemonNFTData('pikachu').then(nft => {
  console.log(nft);
});