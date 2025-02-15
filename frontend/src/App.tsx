// frontend/src/App.tsx
import React, { useEffect, useState } from "react";
import { MealPlan, SwapMealResponse, Meal } from "./types";

const App: React.FC = () => {
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [shoppingList, setShoppingList] = useState<string[]>([]);

    // New state for all meals and selected meal details.
    const [meals, setMeals] = useState<Meal[]>([]);
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

    // Fetch the meal plan on mount
    useEffect(() => {
        fetch("/api/mealplan")
            .then((res) => res.json())
            .then((data: MealPlan) => setMealPlan(data))
            .catch((err) => console.error("Error fetching meal plan:", err));
    }, []);

    // Fetch all meals on component mount.
    useEffect(() => {
        fetch("/api/meals")
            .then((res) => res.json())
            .then((data: Meal[]) => setMeals(data))
            .catch((err) => console.error("Error fetching meals:", err));
    }, []);

    const finalizePlan = () => {
        // In a real implementation, include a mapping of day -> meal ID.
        fetch("/api/mealplan/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: {} })
        })
            .then((res) => res.text())
            .then((text) => alert(text))
            .catch((err) => console.error("Error finalizing plan:", err));
    };

    const swapMeal = (day: string) => {
        fetch("/api/mealplan/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day, meal_id: 0 })
        })
            .then((res) => res.json())
            .then((data: SwapMealResponse) =>
                alert(`Swapped ${day} with: ${data.meal_name} (ID: ${data.new_meal_id})`)
            )
            .catch((err) => console.error("Error swapping meal:", err));
    };

    const getShoppingList = () => {
        if (!mealPlan) return; // Ensure the meal plan is loaded
        // Build an array of meal IDs from the stored plan.
        const mealIDs = Object.values(mealPlan).map((meal) => meal.id);
        fetch("/api/shoppinglist", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ plan: mealIDs }),
        })
            .then((res) => res.json())
            .then((data: string[]) => setShoppingList(data))
            .catch((err) => console.error(err));
    };

    return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
            <h1>Weekly Meal Plan</h1>
            {mealPlan ? (
                <table border={1} cellPadding={5}>
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Meal</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(mealPlan).map(([day, meal]) => (
                            <tr key={day}>
                                <td>{day}</td>
                                <td>{meal.mealName}</td>
                                <td>
                                    {day !== "Friday" && meal.mealName !== "Eating out" && (
                                        <button onClick={() => swapMeal(day)}>Swap Meal</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>Loading meal plan...</p>
            )}

            <hr />
            <h2>Meals</h2>
            {meals.length === 0 ? (
                <p>Loading meals...</p>
            ) : (
                <ul>
                    {meals.map((meal) => (
                        <li
                            key={meal.id}
                            style={{ cursor: "pointer", marginBottom: "5px" }}
                            onClick={() => setSelectedMeal(meal)}
                        >
                            {meal.mealName}
                        </li>
                    ))}
                </ul>
            )}

            {selectedMeal && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Ingredients for {selectedMeal.mealName}</h3>
                    {selectedMeal.ingredients.length === 0 ? (
                        <p>No ingredients found.</p>
                    ) : (
                        <ul>
                            {selectedMeal.ingredients.map((ing, index) => (
                                <li key={index}>
                                    {ing.Quantity} {ing.Unit} {ing.Name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div style={{ marginTop: "20px" }}>
                <button onClick={finalizePlan}>Finalize Meal Plan</button>
                <button onClick={getShoppingList} style={{ marginLeft: "10px" }}>
                    Get Shopping List
                </button>
            </div>
            {shoppingList.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                    <h2>Shopping List</h2>
                    <ul>
                        {shoppingList.map((item, index) => (
                            <li key={index}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default App;