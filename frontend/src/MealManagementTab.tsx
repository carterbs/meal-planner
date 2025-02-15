{
    selectedMeal.ingredients.length === 0 ? (
        <p>No ingredients found.</p>
    ) : (
    <ul>
        {selectedMeal.ingredients.map((ing, index) => (
            <li key={index}>
                {ing.Quantity} {ing.Unit} {ing.Name}
            </li>
        ))}
    </ul>
)
} 