import React, { useEffect, useState } from "react";
import { Meal } from "../types";

interface MealManagementTabProps {
    showToast: (message: string) => void;
}

export const MealManagementTab: React.FC<MealManagementTabProps> = ({ showToast }) => {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

    useEffect(() => {
        fetch("/api/meals")
            .then((res) => res.json())
            .then((data: Meal[]) => setMeals(data))
            .catch((err) => console.error("Error fetching meals:", err));
    }, []);

    return (
        <div>
            <h2>Meal Library</h2>
            <div style={{ display: "flex", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                    <h3>Available Meals</h3>
                    {meals.length === 0 ? (
                        <p>Loading meals...</p>
                    ) : (
                        <ul>
                            {meals.map((meal) => (
                                <li
                                    key={meal.id}
                                    style={{
                                        cursor: "pointer",
                                        marginBottom: "5px",
                                        backgroundColor: selectedMeal?.id === meal.id ? '#f0f0f0' : 'transparent',
                                        padding: "5px"
                                    }}
                                    onClick={() => setSelectedMeal(meal)}
                                >
                                    {meal.mealName}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {selectedMeal && (
                    <div style={{ flex: 1 }}>
                        <h3>Meal Details</h3>
                        <h4>{selectedMeal.mealName}</h4>
                        <p>Effort Level: {selectedMeal.relativeEffort}</p>
                        <p>Contains Red Meat: {selectedMeal.redMeat ? "Yes" : "No"}</p>
                        <h4>Ingredients</h4>
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
                        <button
                            onClick={() => {
                                fetch("/api/meals/swap", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ meal_id: selectedMeal.id }),
                                })
                                    .then((res) => res.json())
                                    .then((newMeal: any) => {
                                        setSelectedMeal(newMeal);
                                        showToast(`Swapped meal for ${newMeal.mealName}`);
                                    })
                                    .catch((err) =>
                                        console.error("Error swapping meal:", err)
                                    );
                            }}
                        >
                            Get Alternative Meal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}; 