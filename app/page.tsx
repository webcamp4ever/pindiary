"use client";

import {
  GoogleMap,
  useLoadScript,
  MarkerF,
  Autocomplete,
} from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";

const containerStyle = {
  width: "100%",
  height: "100vh",
};

type SavedMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address?: string;
};

export default function Home() {
  // ===========================
  // ✅ Google Maps 로드
  // ===========================
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["places"],
  });

  // ===========================
  // 📌 상태
  // ===========================
  const [center, setCenter] = useState({
    lat: 37.5665,
    lng: 126.978,
  });

  const [myLocation, setMyLocation] =
    useState<google.maps.LatLngLiteral | null>(null);

  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);

  const [savedMarkers, setSavedMarkers] =
    useState<SavedMarker[]>([]);

  const [isCardVisible, setIsCardVisible] =
    useState(false);

  const autocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);

  const autoCloseTimer =
    useRef<NodeJS.Timeout | null>(null);

  // ===========================
  // 📍 현재 위치 가져오기
  // ===========================
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCenter(location);
        setMyLocation(location);
      });
    }
  }, []);

  // ===========================
  // 📌 카드 자동 닫힘 (5초)
  // ===========================
  useEffect(() => {
    if (selectedPlace) {
      setIsCardVisible(true);

      /*
      autoCloseTimer.current = setTimeout(() => {
        closeCard();
      }, 5000);
      */
    }

    return () => {
      if (autoCloseTimer.current)
        clearTimeout(autoCloseTimer.current);
    };
  }, [selectedPlace]);

  const closeCard = () => {
    setIsCardVisible(false);

    setTimeout(() => {
      setSelectedPlace(null);
    }, 300);
  };

  // ===========================
  // 🔎 검색 선택
  // ===========================
  const onPlaceChanged = () => {
    if (!autocompleteRef.current) return;

    const place = autocompleteRef.current.getPlace();
    if (!place.geometry?.location) return;

    setCenter({
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    });

    setSelectedPlace(place);
  };

  // ===========================
  // 📌 지도 클릭 (구글 기본 팝업 차단)
  // ===========================
  const handleMapClick = (
    e: google.maps.MapMouseEvent
  ) => {
    if (!mapRef.current) return;

    if ((e as any).placeId) {
      e.stop(); // 🔥 기본 InfoWindow 차단

      const service =
        new google.maps.places.PlacesService(
          mapRef.current
        );

      service.getDetails(
        {
          placeId: (e as any).placeId,
          fields: [
            "name",
            "formatted_address",
            "rating",
            "user_ratings_total",
            "price_level",
            "opening_hours",
            "photos",
            "formatted_phone_number",
            "website",
            "url",
            "place_id",
            "geometry",
            "icon",
            "icon_background_color",
          ],
        },
        (place, status) => {
          if (
            status ===
            google.maps.places
              .PlacesServiceStatus.OK &&
            place
          ) {
            setSelectedPlace(place);
          }
        }
      );
    } else {
      closeCard();
    }
  };

  // ===========================
  // 📌 마커 클릭 (상세 정보 로드)
  // ===========================
  const handleMarkerClick = (marker: SavedMarker) => {
    if (!mapRef.current) return;

    const service = new google.maps.places.PlacesService(mapRef.current);
    service.getDetails(
      {
        placeId: marker.id,
        fields: [
          "name",
          "formatted_address",
          "rating",
          "user_ratings_total",
          "price_level",
          "opening_hours",
          "photos",
          "formatted_phone_number",
          "website",
          "url",
          "place_id",
          "geometry",
        ],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          setSelectedPlace(place);
        }
      }
    );
  };

  // ===========================
  // 📌 저장
  // ===========================
  const handleSavePlace = () => {
    if (!selectedPlace?.geometry?.location) return;

    const newMarker: SavedMarker = {
      id: selectedPlace.place_id!,
      lat: selectedPlace.geometry.location.lat(),
      lng: selectedPlace.geometry.location.lng(),
      name: selectedPlace.name || "",
      address: selectedPlace.formatted_address,
    };

    setSavedMarkers((prev) => [...prev, newMarker]);
  };

  // ===========================
  // 📌 삭제
  // ===========================
  const handleDeletePlace = () => {
    if (!selectedPlace?.place_id) return;

    setSavedMarkers((prev) =>
      prev.filter((m) => m.id !== selectedPlace.place_id)
    );
    closeCard();
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div style={{ position: "relative" }}>
      {/* ===========================
          🔎 검색창
      =========================== */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          width: "90%",
          maxWidth: "400px",
        }}
      >
        <Autocomplete
          onLoad={(ref) =>
            (autocompleteRef.current = ref)
          }
          onPlaceChanged={onPlaceChanged}
          options={{
            fields: [
              "name",
              "formatted_address",
              "geometry",
            ],
          }}
        >
          <input
            type="text"
            placeholder="장소 검색..."
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid #ddd",
              background: "#fff",
              color: "#000",
            }}
          />
        </Autocomplete>
      </div>

      {/* ===========================
          🗺 지도
      =========================== */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onClick={handleMapClick}
        options={{
          clickableIcons: true,
        }}
      >
        {myLocation && (
        <MarkerF
          position={myLocation}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          }}
          zIndex={999} // 다른 마커보다 위에 표시
        />
      )}

        {savedMarkers.map((marker) => (
          <MarkerF
            key={marker.id}
            position={{
              lat: marker.lat,
              lng: marker.lng,
            }}
            onClick={() => handleMarkerClick(marker)}
          />
        ))}
      </GoogleMap>

      {/* ===========================
          📌 하단 고정 카드
      =========================== */}
      {selectedPlace && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: isCardVisible
              ? "translate(-50%,0)"
              : "translate(-50%,40px)",
            opacity: isCardVisible ? 1 : 0,
            transition: "all 0.3s ease",
            width: "92%",
            maxWidth: "420px",
            background: "#fff",
            color: "#222",
            borderRadius: "16px",
            padding: "16px",
            boxShadow:
              "0 12px 30px rgba(0,0,0,0.25)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              textAlign: "right",
              cursor: "pointer",
              marginBottom: "8px",
            }}
            onClick={closeCard}
          >
            ✕
          </div>

          {/* 썸네일 + 이름 */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            {selectedPlace.photos?.[0] && (
              <img
                src={selectedPlace.photos[0].getUrl()}
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "cover",
                  borderRadius: "12px",
                }}
              />
            )}

            <div>
              <h3
  style={{
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }}
>
  {selectedPlace.icon && (
    <img
      src={selectedPlace.icon}
      alt="category"
      style={{
        width: "20px",
        height: "20px",
        backgroundColor:
          selectedPlace.icon_background_color || "transparent",
        borderRadius: "4px",
        padding: "2px",
      }}
    />
  )}

  <span>{selectedPlace.name}</span>

  {selectedPlace.rating && (
    <span
      style={{
        fontSize: "14px",
        marginLeft: "6px",
        color: "#f5a623",
      }}
    >
      ⭐ {selectedPlace.rating}
    </span>
  )}
</h3>
             
  {(selectedPlace.opening_hours || selectedPlace.formatted_phone_number) && (
  <div
    style={{
      display: "flex",
      gap: "12px",
      alignItems: "center",
      fontSize: "14px",
      marginTop: "6px",
    }}
  >
    {/* 🕒 영업 여부 */}
    {selectedPlace.opening_hours && (
      <span
        style={{
          color: selectedPlace.opening_hours.isOpen()
            ? "#2e7d32" // 🟢 영업중 (초록)
            : "#9e9e9e", // 🔴 영업종료 (회색)
          fontWeight: 500,
        }}
      >
        {selectedPlace.opening_hours.isOpen()
          ? "🟢 영업중"
          : "🔴 영업종료"}
      </span>
    )}

    {/* 📞 전화번호 (클릭 시 바로 전화) */}
    {selectedPlace.formatted_phone_number && (
      <a
        href={`tel:${selectedPlace.formatted_phone_number.replace(
          /[^0-9+]/g,
          ""
        )}`}
        style={{
          color: "#1976d2",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        📞 {selectedPlace.formatted_phone_number}
      </a>
    )}
  </div>
)}
         <p
                style={{
                  fontSize: "13px",
                  color: "#666",
                }}
              >
                {selectedPlace.formatted_address}
              </p>              
            </div>
          </div>   

        
{/*
          {selectedPlace.website && (
            <p>
              <a
                href={selectedPlace.website}
                target="_blank"
              >
                🌐 홈페이지
              </a>
            </p>
          )}
*/}
          {selectedPlace.url && (
            <p>
              <a
                href={selectedPlace.url}
                target="_blank"
              >
                🗺 지도에서 보기
              </a>
            </p>
          )}

          {savedMarkers.some((m) => m.id === selectedPlace.place_id) ? (
            <button
              onClick={handleDeletePlace}
              style={{
                marginTop: "10px",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: "#d32f2f",
                color: "#fff",
                cursor: "pointer",
                width: "100%",
              }}
            >
              🗑 PinDiary 삭제
            </button>
          ) : (
            <button
              onClick={handleSavePlace}
              style={{
                marginTop: "10px",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: "#1976d2",
                color: "#fff",
                cursor: "pointer",
                width: "100%",
              }}
            >
              📌 PinDiary 저장
            </button>
          )}
        </div>
      )}
    </div>
  );
}