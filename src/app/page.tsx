"use client";
import Image from "next/image";
import { useCallback, useState } from "react";

interface Subcategory {
  id: string;
  name: string;
  code: number;
}

interface Category {
  id: string;
  name: string;
  childrenCategories: Subcategory[];
}

interface TeacherCategoryInfo {
  name: string;
  pricePerHour: number;
}

interface Teacher {
  id: string;
  categories: TeacherCategoryInfo[];
}

interface SearchResponse {
  teachers: Teacher[];
  totalResults: number;
}

interface CalculationResult {
  categoryName: string;
  averagePrice: number;
  status: "success" | "error";
  message?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const API_BASE_URL = "https://test.teaching-me.org/users/v1/open";
  const COMMON_HEADERS = {
    "Accept-Language": "en",
    "Content-Type": "application/json",
  };

  const fetchCategories = async (): Promise<Category[]> => {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      method: "GET",
      headers: { "Accept-Language": "en" },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch categories");
    }
    return response.json();
  };

  const fetchAllTeachersForCategory = async (
    categoryId: number
  ): Promise<Teacher[]> => {
    let allTeachers: Teacher[] = [];
    let page = 0;
    const pageSize = 10;

    while (true) {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          categories: [categoryId],
          page,
          pageSize,
        }),
      });

      if (!response.ok) {
        console.error(
          `Failed to fetch teachers for category ${categoryId} on page ${page}`
        );
        break;
      }

      const data: SearchResponse = await response.json();
      const teachersOnPage = data.teachers || [];

      if (teachersOnPage.length === 0) {
        break;
      }

      allTeachers = [...allTeachers, ...teachersOnPage];
      page++;
    }
    return allTeachers;
  };

  const postAveragePrice = async (
    categoryName: string,
    averagePrice: number
  ): Promise<Response> => {
    const response = await fetch(`${API_BASE_URL}/average-price`, {
      method: "POST",
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        categoryName,
        averagePrice,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to post average price for ${categoryName}`);
    }
    return response;
  };

  const handleCalculatePrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const categories = await fetchCategories();
      if (!categories || categories.length === 0) {
        setError("No categories found.");
        return;
      }

      const allSubcategories = categories.flatMap(
        (category) => category.childrenCategories || []
      );

      if (allSubcategories.length === 0) {
        setError("No subcategories found to process.");
        return;
      }

      const calculationPromises = allSubcategories.map(async (subcategory) => {
        try {
          const teachers = await fetchAllTeachersForCategory(subcategory.code);
          let totalPrice = 0;
          let teachersWithPriceForCategory = 0;

          teachers.forEach((teacher) => {
            const relevantCategory = teacher.categories?.find(
              (cat) => cat.name === subcategory.name
            );

            if (
              relevantCategory &&
              typeof relevantCategory.pricePerHour === "number"
            ) {
              totalPrice += relevantCategory.pricePerHour;
              teachersWithPriceForCategory++;
            }
          });

          const averagePrice =
            teachersWithPriceForCategory > 0
              ? totalPrice / teachersWithPriceForCategory
              : 0;

          const roundedAveragePrice = Math.round(averagePrice * 100) / 100;

          await postAveragePrice(subcategory.name, roundedAveragePrice);

          return {
            categoryName: subcategory.name,
            averagePrice: roundedAveragePrice,
            status: "success" as const,
            message: `Successfully posted average price of ${roundedAveragePrice} for ${teachersWithPriceForCategory} teachers.`,
          };
        } catch (catError) {
          console.error(
            `Error processing subcategory ${subcategory.name}:`,
            catError
          );
          return {
            categoryName: subcategory.name,
            averagePrice: 0,
            status: "error" as const,
            message:
              catError instanceof Error
                ? catError.message
                : "An unknown error occurred.",
          };
        }
      });

      const settledResults = await Promise.all(calculationPromises);
      setResults(settledResults);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "An unexpected error occurred."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <>
      <main className="  p-6  border border-slate-700">
        <div className="flex justify-center mb-8">
          <button
            onClick={handleCalculatePrices}
            disabled={isLoading}
            className="px-8 py-4 bg-gray-500 text-white font-bold text-lg rounded-lg hover:bg-gray-400 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isLoading ? "Calculating..." : "Calculate Average Prices"}
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center flex-col text-center">
            <p className="mt-4 ">Fetching categories and teachers.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-center">
            <h3 className="font-bold mb-2">An Error Occurred</h3>
            <p>{error}</p>
          </div>
        )}

        {results.length > 0 && !isLoading && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center  border-b border-slate-700 pb-2">
              Calculation Results
            </h2>
            <ul className="divide-y divide-slate-700">
              {results.map((result) => (
                <li
                  key={result.categoryName}
                  className="p-4 flex justify-between items-center "
                >
                  <div>
                    <p className="font-semibold text-lg ">
                      {result.categoryName}
                    </p>
                    <p className="text-sm ">{result.message}</p>
                  </div>
                  <div className="text-right">
                    {result.status === "success" ? (
                      <span className="text-xl font-bold ">
                        ${result.averagePrice.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xl font-bold text-red-500">
                        Failed
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <div className="flex rounded-xl border-2 border-gray-500 items-start max-w-lg p-6 m-4">
        <Image
          className="rounded-full m-2"
          src="/icon.png"
          alt="Icon"
          width={64}
          height={64}
        />

        <div className="flex flex-col flex-1 ml-2">
          <div className="flex justify-between items-start  max-w-fit">
            <div>
              <div className="text-xl font-semibold max-w-fit">
                Request for the lesson
              </div>
              <p className="text-gray-500 max-w-sm text-balance">
                Daniel Hamilton wants to start a lesson, please confirm or deny
                the request
              </p>
              <p className="text-sm text-gray-400 max-w-fit pt-2">
                18 Dec, 14:50pm, 2022
              </p>
            </div>

            <button
              className="w-8 h-8 flex items-center justify-center 
                       rounded-full border-2 font-semibold border-gray-800 text-gray-800 
                       hover:bg-gray-200 hover:text-black transition"
            >
              ✕
            </button>
          </div>

          <div className="flex justify-end gap-2 mt-4 mr-2">
            <button className="w-36 h-10 border border-gray-500 rounded-xl hover:border-transparent hover:bg-gray-500 hover:text-white active:bg-gray-700">
              View details
            </button>
            <button className="w-32 h-10 text-white border bg-black border-black rounded-xl hover:border-transparent hover:bg-gray-500 active:bg-gray-700">
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
